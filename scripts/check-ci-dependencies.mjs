#!/usr/bin/env node
/**
 * Check workflow action refs and separately downloaded CI tools against stable releases.
 *
 * A newer upstream release is external state, not something the checked commit caused
 * (CI/CD best practices, principle 17). Outdated pins are reported as warnings plus
 * a step summary on every event. Dependabot (.github/dependabot.yml) proposes bumps
 * after its cooldown without blocking unrelated pull requests.
 * Mutable pins, checksum or digest mismatches, and lookup errors fail on every event.
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const stableVersion = /^v?\d+\.\d+\.\d+$/;
const OUTDATED = 'outdated';
const BROKEN = 'broken';

/** Release binaries that workflows download themselves: `<PREFIX>_VERSION` plus `<PREFIX>_SHA256`. */
export const downloadedTools = [
  { prefix: 'OSV_SCANNER', repo: 'google/osv-scanner', asset: 'osv-scanner_linux_amd64' },
];

export function collectDependencies(directory) {
  const dependencies = [];
  for (const name of readdirSync(directory).filter(name => /\.ya?ml$/.test(name))) {
    const path = resolve(directory, name);
    const yaml = readFileSync(path, 'utf8');
    let bunActions = 0;
    let bunVersions = 0;
    for (const [, literal, comment] of yaml.matchAll(/^[ \t]*(?:-[ \t]+)?uses:[ \t]*([^\s#]+)[ \t]*(?:#([^\r\n]*))?/gm)) {
      const reference = literal.replace(/^(['"])(.*)\1$/, '$2');
      if (reference.startsWith('./')) continue;
      if (reference.startsWith('docker://')) {
        const match = reference.match(/^docker:\/\/rhysd\/actionlint:(\d+\.\d+\.\d+)@sha256:([a-f0-9]{64})$/);
        if (!match) throw new Error(`${name}: pin Actionlint to a version and sha256 digest`);
        dependencies.push({ path, repo: 'rhysd/actionlint', version: `v${match[1]}`, digest: `sha256:${match[2]}` });
        continue;
      }
      const match = reference.match(/^([\w.-]+\/[\w.-]+)(?:\/[^@]+)?@(v\d+\.\d+\.\d+|[a-fA-F0-9]{40})$/);
      if (!match) throw new Error(`${name}: use an exact stable action version or full SHA with a # vX.Y.Z comment: ${reference}`);
      const [, repo, ref] = match;
      const sha = /^[a-fA-F0-9]{40}$/.test(ref) ? ref.toLowerCase() : undefined;
      const version = sha ? comment?.trim().match(/^(v\d+\.\d+\.\d+)$/)?.[1] : ref;
      if (!version) throw new Error(`${name}: SHA-pinned actions need an exact stable # vX.Y.Z comment: ${reference}`);
      dependencies.push({ path, repo, version, ...(sha ? { sha } : {}) });
      if (repo === 'oven-sh/setup-bun') bunActions++;
    }
    for (const [, version] of yaml.matchAll(/^[ \t]*(?:-[ \t]+)?bun-version:[ \t]*['"]?([^\s'"#]+)/gm)) {
      if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`${name}: pin bun-version to an exact stable version`);
      dependencies.push({ path, repo: 'oven-sh/bun', version: `bun-v${version}` });
      bunVersions++;
    }
    if (bunActions !== bunVersions) throw new Error(`${name}: every setup-bun action must pin bun-version`);
    for (const tool of downloadedTools) {
      const versions = [...yaml.matchAll(new RegExp(`^[ \\t]*${tool.prefix}_VERSION:[ \\t]*['"]?([^\\s'"#]+)`, 'gm'))];
      const checksums = [...yaml.matchAll(new RegExp(`^[ \\t]*${tool.prefix}_SHA256:[ \\t]*['"]?([^\\s'"#]+)`, 'gm'))];
      if (versions.length !== checksums.length) {
        throw new Error(`${name}: every ${tool.prefix}_VERSION needs a ${tool.prefix}_SHA256 checksum`);
      }
      versions.forEach(([, version], index) => {
        const sha256 = checksums[index][1];
        if (!stableVersion.test(version) || !version.startsWith('v')) {
          throw new Error(`${name}: pin ${tool.prefix}_VERSION to an exact stable version`);
        }
        if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error(`${name}: ${tool.prefix}_SHA256 must be a sha256 hex digest`);
        dependencies.push({ path, repo: tool.repo, version, asset: tool.asset, sha256 });
      });
    }
  }
  return dependencies;
}

function latestRelease(repo) {
  // gh provides authentication without logging the token.
  const release = JSON.parse(execFileSync('gh', ['api', `repos/${repo}/releases/latest`], { encoding: 'utf8' }));
  const version = release.tag_name;
  const normalized = repo === 'oven-sh/bun' ? version?.replace(/^bun-/, '') : version;
  if (!stableVersion.test(normalized) || release.draft || release.prerelease) {
    throw new Error(`${repo}: latest release did not identify a stable version`);
  }
  return version;
}

async function actionlintDigest(version) {
  const response = await fetch(`https://registry.hub.docker.com/v2/repositories/rhysd/actionlint/tags/${version.replace(/^v/, '')}`);
  if (!response.ok) throw new Error(`Docker Hub: HTTP ${response.status} for Actionlint ${version}`);
  const data = await response.json();
  if (!/^sha256:[a-f0-9]{64}$/.test(data.digest)) throw new Error('Docker Hub returned no valid image digest');
  return data.digest;
}

function releaseAssetDigest(repo, version, asset) {
  const release = JSON.parse(execFileSync('gh', ['api', `repos/${repo}/releases/tags/${version}`], { encoding: 'utf8' }));
  const digest = release.assets?.find(candidate => candidate.name === asset)?.digest;
  if (!/^sha256:[a-f0-9]{64}$/.test(digest || '')) throw new Error(`${repo} ${version}: release asset ${asset} has no sha256 digest`);
  return digest.slice('sha256:'.length);
}

function actionTagSha(repo, version) {
  // The commits endpoint resolves lightweight and annotated tags to the commit.
  const commit = JSON.parse(execFileSync('gh', ['api', `repos/${repo}/commits/${version}`], { encoding: 'utf8' }));
  if (!/^[a-fA-F0-9]{40}$/.test(commit.sha || '')) throw new Error(`${repo} ${version}: tag resolved to no valid commit SHA`);
  return commit.sha.toLowerCase();
}

/**
 * Cache upstream lookups and classify each problem. `outdated` means a newer stable release
 * exists; `broken` means a pinned SHA, digest or checksum does not match upstream. Lookup errors throw.
 */
export async function findProblems(dependencies, latest = latestRelease, digest = actionlintDigest, assetDigest = releaseAssetDigest, tagSha = actionTagSha) {
  const releases = new Map();
  const digests = new Map();
  const commits = new Map();
  const problems = [];
  for (const dependency of dependencies) {
    const { path, repo, version } = dependency;
    if (!releases.has(repo)) releases.set(repo, await latest(repo));
    const current = releases.get(repo);
    if (version !== current) {
      problems.push({ kind: OUTDATED, message: `${path}: ${repo} ${version} is outdated; latest stable is ${current}` });
    }
    if (dependency.sha) {
      const key = `${repo}@${version}`;
      if (!commits.has(key)) commits.set(key, await tagSha(repo, version));
      if (dependency.sha !== commits.get(key)) {
        problems.push({ kind: BROKEN, message: `${path}: ${repo} SHA ${dependency.sha} does not match tag ${version}` });
      }
    }
    if (dependency.digest) {
      if (!digests.has(version)) digests.set(version, await digest(version));
      if (dependency.digest !== digests.get(version)) {
        problems.push({ kind: BROKEN, message: `${path}: Actionlint ${version} image digest does not match Docker Hub` });
      }
    }
    if (dependency.sha256) {
      const key = `${repo}@${version}/${dependency.asset}`;
      if (!digests.has(key)) digests.set(key, await assetDigest(repo, version, dependency.asset));
      if (dependency.sha256 !== digests.get(key)) {
        problems.push({ kind: BROKEN, message: `${path}: ${repo} ${version} ${dependency.asset} sha256 does not match the release asset` });
      }
    }
  }
  return problems;
}

/** Backwards-compatible list of problem messages. */
export async function checkDependencies(...args) {
  return (await findProblems(...args)).map(problem => problem.message);
}

function escapeCommandData(value) {
  return value.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

/**
 * Turn problems into an exit code, workflow-command lines, and a step summary.
 * Outdated pins warn on every event; broken pins always fail.
 */
export function report(problems, count) {
  const outdated = problems.filter(problem => problem.kind === OUTDATED);
  const broken = problems.filter(problem => problem.kind !== OUTDATED);
  const lines = [];
  for (const { message } of broken) lines.push(`::error title=CI dependency pin mismatch::${escapeCommandData(message)}`);
  for (const { message } of outdated) {
    lines.push(`::warning title=Outdated CI dependency::${escapeCommandData(message)}`);
  }
  if (!problems.length) lines.push(`All ${count} CI dependency declarations match their latest stable releases.`);
  else if (outdated.length) {
    lines.push(`${outdated.length} outdated CI dependency pin(s) reported as warnings; Dependabot or a pull request bumps them.`);
  }
  const summary = ['## CI dependency freshness', ''];
  if (!problems.length) summary.push(`All ${count} CI dependency declarations match their latest stable releases.`);
  for (const { message } of broken) summary.push(`- :x: ${message}`);
  for (const { message } of outdated) summary.push(`- :warning: ${message}`);
  if (outdated.length) {
    summary.push('', 'A newer upstream release is external state, so it is a warning on every event. Bump the pins in a pull request (Dependabot proposes action bumps).');
  }
  const exitCode = broken.length ? 1 : 0;
  return { exitCode, lines, summary: `${summary.join('\n')}\n` };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const directory = process.env.CI_DEPENDENCIES_WORKFLOW_DIRECTORY || resolve(import.meta.dirname, '..', '.github', 'workflows');
    const dependencies = collectDependencies(directory);
    const result = report(await findProblems(dependencies), dependencies.length);
    for (const line of result.lines) console.log(line);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, result.summary);
    process.exitCode = result.exitCode;
  } catch (error) {
    console.error(`::error title=CI dependency check failed::${escapeCommandData(error.message)}`);
    process.exitCode = 1;
  }
}
