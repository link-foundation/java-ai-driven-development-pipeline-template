#!/usr/bin/env node
/**
 * Changelog fragment collection script.
 *
 * Collects all changelog fragments from changelog.d/ and merges them
 * into CHANGELOG.md under a new version entry.
 *
 * Usage:
 *   bun scripts/collect-changelog.mjs [--dry-run]
 */

import { readFileSync, writeFileSync, readdirSync, unlinkSync, existsSync } from 'fs';
import { join, basename } from 'path';

/**
 * Parse command line arguments.
 */
function parseArgs() {
  const args = process.argv.slice(2);
  let dryRun = false;

  for (const arg of args) {
    if (arg === '--dry-run') {
      dryRun = true;
    }
  }

  return { dryRun };
}

/**
 * Get the current version from pom.xml.
 * @param {string} pomPath - Path to pom.xml
 * @returns {string} Current version
 */
function getCurrentVersion(pomPath) {
  const content = readFileSync(pomPath, 'utf-8');
  const match = content.match(/<project[^>]*>[\s\S]*?<version>([^<]+)<\/version>/);
  if (!match) {
    throw new Error('Could not find version in pom.xml');
  }
  return match[1];
}

/**
 * Find all changelog fragment files.
 * @param {string} changelogDir - Path to changelog.d directory
 * @returns {string[]} Array of fragment file paths
 */
function findFragments(changelogDir) {
  if (!existsSync(changelogDir)) {
    return [];
  }

  return readdirSync(changelogDir)
    .filter((file) => file.endsWith('.md') && file !== 'README.md')
    .map((file) => join(changelogDir, file))
    .sort();
}

/**
 * Read and combine fragment contents.
 * @param {string[]} fragmentPaths - Array of fragment file paths
 * @returns {string} Combined content
 */
function combineFragments(fragmentPaths) {
  const contents = [];

  for (const path of fragmentPaths) {
    const content = readFileSync(path, 'utf-8').trim();
    if (content) {
      contents.push(content);
    }
  }

  return contents.join('\n\n');
}

/**
 * Get current date in YYYY-MM-DD format.
 * @returns {string} Formatted date
 */
function getCurrentDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Update CHANGELOG.md with new version entry.
 * @param {string} changelogPath - Path to CHANGELOG.md
 * @param {string} version - Version number
 * @param {string} content - Changelog content
 */
function updateChangelog(changelogPath, version, content) {
  let changelog = '';

  if (existsSync(changelogPath)) {
    changelog = readFileSync(changelogPath, 'utf-8');
  } else {
    changelog = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

`;
  }

  const date = getCurrentDate();
  const newEntry = `## [${version}] - ${date}\n\n${content}\n\n`;

  // Find the insertion point (after the header, before first version entry)
  const insertMarker = '<!-- changelog-insert-here -->';
  if (changelog.includes(insertMarker)) {
    changelog = changelog.replace(insertMarker, `${insertMarker}\n\n${newEntry}`);
  } else {
    // Insert after the header section
    const headerEndMatch = changelog.match(/^(# Changelog[\s\S]*?\n)\n/m);
    if (headerEndMatch) {
      const headerEnd = headerEndMatch.index + headerEndMatch[0].length;
      changelog =
        changelog.slice(0, headerEnd) + newEntry + changelog.slice(headerEnd);
    } else {
      changelog = newEntry + changelog;
    }
  }

  writeFileSync(changelogPath, changelog);
}

/**
 * Delete processed fragment files.
 * @param {string[]} fragmentPaths - Array of fragment file paths
 */
function deleteFragments(fragmentPaths) {
  for (const path of fragmentPaths) {
    unlinkSync(path);
    console.log(`Deleted: ${basename(path)}`);
  }
}

/**
 * Main function.
 */
function main() {
  const { dryRun } = parseArgs();
  const projectRoot = process.cwd();
  const pomPath = join(projectRoot, 'pom.xml');
  const changelogDir = join(projectRoot, 'changelog.d');
  const changelogPath = join(projectRoot, 'CHANGELOG.md');

  const version = getCurrentVersion(pomPath);
  console.log(`Collecting changelog fragments for version ${version}...`);

  const fragments = findFragments(changelogDir);

  if (fragments.length === 0) {
    console.log('No changelog fragments found.');
    return;
  }

  console.log(`Found ${fragments.length} fragment(s):`);
  for (const path of fragments) {
    console.log(`  - ${basename(path)}`);
  }

  const content = combineFragments(fragments);

  if (dryRun) {
    console.log('\n[DRY RUN] Would add the following to CHANGELOG.md:');
    console.log(`\n## [${version}] - ${getCurrentDate()}\n`);
    console.log(content);
    console.log('\n[DRY RUN] No changes made.');
    return;
  }

  updateChangelog(changelogPath, version, content);
  console.log(`Updated CHANGELOG.md with version ${version}`);

  deleteFragments(fragments);

  console.log('\nChangelog collection complete!');
}

main();
