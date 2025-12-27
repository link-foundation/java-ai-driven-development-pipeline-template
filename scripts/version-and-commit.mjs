#!/usr/bin/env node
/**
 * Version and commit script for CI/CD releases.
 *
 * This script handles the complete release workflow:
 * 1. Collects changelog fragments
 * 2. Bumps version in pom.xml and Java source
 * 3. Commits changes
 * 4. Creates a git tag
 * 5. Pushes to remote
 *
 * Usage:
 *   bun scripts/version-and-commit.mjs --bump-type <major|minor|patch>
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

/**
 * Parse command line arguments.
 */
function parseArgs() {
  const args = process.argv.slice(2);
  let bumpType = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--bump-type' && args[i + 1]) {
      bumpType = args[i + 1];
      i++;
    }
  }

  if (!bumpType || !['major', 'minor', 'patch'].includes(bumpType)) {
    console.error('Usage: version-and-commit.mjs --bump-type <major|minor|patch>');
    process.exit(1);
  }

  return { bumpType };
}

/**
 * Execute a shell command.
 * @param {string} command - Command to execute
 * @param {object} options - execSync options
 * @returns {string} Command output
 */
function exec(command, options = {}) {
  console.log(`$ ${command}`);
  return execSync(command, { encoding: 'utf-8', ...options }).trim();
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
 * Bump version according to semantic versioning.
 * @param {string} version - Current version
 * @param {string} bumpType - Type of bump
 * @returns {string} New version
 */
function bumpVersion(version, bumpType) {
  const parts = version.split('.').map(Number);
  let [major, minor, patch] = parts;

  switch (bumpType) {
    case 'major':
      major++;
      minor = 0;
      patch = 0;
      break;
    case 'minor':
      minor++;
      patch = 0;
      break;
    case 'patch':
      patch++;
      break;
  }

  return `${major}.${minor}.${patch}`;
}

/**
 * Update version in pom.xml.
 * @param {string} pomPath - Path to pom.xml
 * @param {string} oldVersion - Current version
 * @param {string} newVersion - New version
 */
function updatePomVersion(pomPath, oldVersion, newVersion) {
  let content = readFileSync(pomPath, 'utf-8');

  let replaced = false;
  content = content.replace(
    /(<project[^>]*>[\s\S]*?<version>)([^<]+)(<\/version>)/,
    (match, before, version, after) => {
      if (!replaced && version === oldVersion) {
        replaced = true;
        return `${before}${newVersion}${after}`;
      }
      return match;
    }
  );

  writeFileSync(pomPath, content);
  console.log(`Updated pom.xml: ${oldVersion} -> ${newVersion}`);
}

/**
 * Update version in Java source file.
 * @param {string} javaPath - Path to Java file
 * @param {string} oldVersion - Current version
 * @param {string} newVersion - New version
 */
function updateJavaVersion(javaPath, oldVersion, newVersion) {
  if (!existsSync(javaPath)) {
    console.log(`Java source file not found: ${javaPath}`);
    return;
  }

  let content = readFileSync(javaPath, 'utf-8');
  content = content.replace(
    new RegExp(`VERSION = "${oldVersion.replace(/\./g, '\\.')}"`, 'g'),
    `VERSION = "${newVersion}"`
  );
  writeFileSync(javaPath, content);
  console.log(`Updated Java source: ${oldVersion} -> ${newVersion}`);
}

/**
 * Check if a git tag exists.
 * @param {string} tag - Tag name
 * @returns {boolean} True if tag exists
 */
function tagExists(tag) {
  try {
    exec(`git rev-parse ${tag}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Set GitHub Actions output.
 * @param {string} name - Output name
 * @param {string} value - Output value
 */
function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
    console.log(`Set output: ${name}=${value}`);
  }
}

/**
 * Main function.
 */
async function main() {
  const { bumpType } = parseArgs();
  const projectRoot = process.cwd();
  const pomPath = join(projectRoot, 'pom.xml');
  const javaPath = join(
    projectRoot,
    'src/main/java/com/linkfoundation/mypackage/MyPackage.java'
  );

  // Get current and new versions
  const currentVersion = getCurrentVersion(pomPath);
  const newVersion = bumpVersion(currentVersion, bumpType);
  const tag = `v${newVersion}`;

  console.log(`\nVersion bump: ${currentVersion} -> ${newVersion} (${bumpType})`);

  // Check if this version was already released
  if (tagExists(tag)) {
    console.log(`Tag ${tag} already exists. Skipping release.`);
    setOutput('released', 'false');
    setOutput('new_version', newVersion);
    return;
  }

  // Collect changelog fragments (if script exists)
  const collectScript = join(projectRoot, 'scripts/collect-changelog.mjs');
  if (existsSync(collectScript)) {
    try {
      exec(`node ${collectScript}`);
    } catch (err) {
      console.log('No changelog fragments to collect');
    }
  }

  // Update version files
  updatePomVersion(pomPath, currentVersion, newVersion);
  updateJavaVersion(javaPath, currentVersion, newVersion);

  // Configure git
  exec('git config user.name "github-actions[bot]"');
  exec('git config user.email "github-actions[bot]@users.noreply.github.com"');

  // Stage changes
  exec('git add pom.xml CHANGELOG.md');
  exec(`git add "${javaPath}" || true`);

  // Commit
  const commitMessage = `chore: release v${newVersion}`;
  exec(`git commit -m "${commitMessage}" || echo "Nothing to commit"`);

  // Create tag
  exec(`git tag -a ${tag} -m "Release ${newVersion}"`);
  console.log(`Created tag: ${tag}`);

  // Push changes and tags
  exec('git push');
  exec('git push --tags');
  console.log('Pushed changes and tags to remote');

  // Set outputs
  setOutput('released', 'true');
  setOutput('new_version', newVersion);

  console.log(`\nRelease ${newVersion} complete!`);
}

main();
