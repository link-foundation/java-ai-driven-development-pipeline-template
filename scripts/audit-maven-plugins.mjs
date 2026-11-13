#!/usr/bin/env node
/**
 * Audit the Maven build plugins in pom.xml against OSV (https://osv.dev).
 *
 * OSV-Scanner resolves pom.xml <dependencies> and their transitive closure, but it
 * does not read <build><plugins>, plugin <dependencies>, or the google-java-format
 * version that Spotless downloads. This script queries OSV for exactly those
 * coordinates and the optional Maven resolution report, so advisories in plugin
 * transitives and the complete project/test tree also fail the security audit.
 * Every severity counts: any known advisory exits 1.
 */
import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const OSV_QUERY_BATCH = 'https://api.osv.dev/v1/querybatch';
const DEFAULT_PLUGIN_GROUP = 'org.apache.maven.plugins';

function stripComments(xml) {
  return xml.replace(/<!--[\s\S]*?-->/g, '');
}

function child(block, tag) {
  return block.match(new RegExp(`<${tag}>\\s*([^<]*?)\\s*</${tag}>`))?.[1];
}

function blocks(xml, tag) {
  return [...xml.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g'))].map(match => match[1]);
}

function properties(pom) {
  const section = pom.match(/<properties>([\s\S]*?)<\/properties>/)?.[1] || '';
  const values = new Map();
  for (const [, name, value] of section.matchAll(/<([\w.-]+)>\s*([^<]*?)\s*<\/\1>/g)) values.set(name, value);
  return values;
}

function interpolate(value, values, where) {
  const resolved = value.replace(/\$\{([^}]+)\}/g, (_, name) => {
    if (!values.has(name)) throw new Error(`${where}: property \${${name}} is not defined in pom.xml`);
    return values.get(name);
  });
  if (!/^[\w.+-]+$/.test(resolved)) throw new Error(`${where}: pin an exact version, not ${resolved}`);
  return resolved;
}

/** Collect build plugins, plugin dependencies, and the Spotless formatter version from a pom.xml string. */
export function collectBuildArtifacts(pomXml) {
  const pom = stripComments(pomXml);
  const values = properties(pom);
  const artifacts = new Map();
  const add = (groupId, artifactId, version) => {
    const name = `${groupId}:${artifactId}`;
    if (!version) throw new Error(`${name}: build plugins must declare an explicit version`);
    const resolved = interpolate(version, values, name);
    artifacts.set(`${name}@${resolved}`, { name, version: resolved });
  };
  for (const plugin of blocks(pom, 'plugin')) {
    // Only the plugin's own coordinates: drop nested sections that also contain <version>.
    const own = plugin.replace(/<(configuration|executions|dependencies)>[\s\S]*?<\/\1>/g, '');
    add(child(own, 'groupId') || DEFAULT_PLUGIN_GROUP, child(own, 'artifactId'), child(own, 'version'));
    for (const dependencies of blocks(plugin, 'dependencies')) {
      for (const dependency of blocks(dependencies, 'dependency')) {
        add(child(dependency, 'groupId'), child(dependency, 'artifactId'), child(dependency, 'version'));
      }
    }
    for (const formatter of blocks(plugin, 'googleJavaFormat')) {
      const version = child(formatter, 'version');
      if (version) add('com.google.googlejavaformat', 'google-java-format', version);
    }
  }
  return [...artifacts.values()];
}

/** Parse Maven dependency:list / dependency:resolve-plugins reports, including test scope. */
export function collectResolvedArtifacts(report) {
  const artifacts = new Map();
  for (const line of report.split('\n')) {
    const coordinate = line.trim().split(/\s/)[0];
    if (!coordinate.includes(':')) continue;
    const parts = coordinate.split(':');
    if (parts.length < 4 || parts.length > 6 || !parts.every(part => /^[\w.+-]+$/.test(part))) {
      throw new Error(`Invalid resolved Maven coordinate: ${coordinate}`);
    }
    const scope = /^(compile|provided|runtime|test|system)$/.test(parts.at(-1));
    const version = parts.at(scope ? -2 : -1);
    const name = `${parts[0]}:${parts[1]}`;
    artifacts.set(`${name}@${version}`, { name, version });
  }
  if (!artifacts.size) throw new Error('Maven resolution report contains no artifacts');
  return [...artifacts.values()];
}

async function osvQueryBatch(queries) {
  const response = await fetch(OSV_QUERY_BATCH, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ queries }),
  });
  if (!response.ok) throw new Error(`OSV: HTTP ${response.status} for ${OSV_QUERY_BATCH}`);
  const data = await response.json();
  if (!Array.isArray(data.results) || data.results.length !== queries.length) {
    throw new Error('OSV: query batch returned an unexpected number of results');
  }
  return data.results;
}

/** Return `{ name, version, ids }` for every artifact with at least one OSV advisory. */
export async function auditArtifacts(artifacts, query = osvQueryBatch) {
  const queries = artifacts.map(({ name, version }) => ({ package: { ecosystem: 'Maven', name }, version }));
  const results = await query(queries);
  return artifacts
    .map((artifact, index) => ({ ...artifact, ids: (results[index]?.vulns || []).map(vuln => vuln.id) }))
    .filter(finding => finding.ids.length);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const pomPath = resolve(process.argv[2] || 'pom.xml');
    const declared = collectBuildArtifacts(readFileSync(pomPath, 'utf8'));
    const resolved = process.argv[3] ? collectResolvedArtifacts(readFileSync(process.argv[3], 'utf8')) : [];
    const artifacts = [...new Map([...declared, ...resolved].map(artifact => [`${artifact.name}@${artifact.version}`, artifact])).values()];
    const findings = await auditArtifacts(artifacts);
    const summary = ['## Maven build plugin audit (OSV)', ''];
    for (const { name, version, ids } of findings) {
      const links = ids.map(id => `https://osv.dev/vulnerability/${id}`).join(' ');
      console.log(`::error title=Vulnerable Maven build artifact::${name} ${version}: ${links}`);
      summary.push(`- :x: \`${name}\` ${version}: ${links}`);
    }
    if (findings.length) {
      console.error(`${findings.length} of ${artifacts.length} build artifacts have OSV advisories.`);
      process.exitCode = 1;
    } else {
      const message = `No OSV advisories for ${artifacts.length} build artifacts: ${artifacts.map(({ name, version }) => `${name}@${version}`).join(', ')}`;
      console.log(message);
      summary.push(message);
    }
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary.join('\n')}\n`);
  } catch (error) {
    console.error(`::error title=Maven build plugin audit failed::${error.message}`);
    process.exitCode = 1;
  }
}
