#!/usr/bin/env node
/**
 * Manual changelog fragment creation script.
 *
 * Creates a new changelog fragment file with a template structure.
 *
 * Usage:
 *   bun scripts/create-manual-changeset.mjs [--description <description>]
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

/**
 * Parse command line arguments.
 */
function parseArgs() {
  const args = process.argv.slice(2);
  let description = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--description' && args[i + 1]) {
      description = args[i + 1];
      i++;
    }
  }

  return { description };
}

/**
 * Generate a timestamp-based filename.
 * @returns {string} Filename in format YYYYMMDD_HHMMSS
 */
function generateTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

/**
 * Get current git branch name.
 * @returns {string} Branch name or 'unknown'
 */
function getBranchName() {
  try {
    return execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

/**
 * Sanitize a string for use in filename.
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
function sanitizeForFilename(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 50);
}

/**
 * Generate the fragment template content.
 * @returns {string} Template content
 */
function generateTemplate() {
  return `### Added

- Add your changes here

### Changed

- Add your changes here

### Fixed

- Add your changes here
`;
}

/**
 * Main function.
 */
function main() {
  const { description } = parseArgs();
  const projectRoot = process.cwd();
  const changelogDir = join(projectRoot, 'changelog.d');

  // Ensure changelog.d directory exists
  if (!existsSync(changelogDir)) {
    mkdirSync(changelogDir, { recursive: true });
    console.log('Created changelog.d directory');
  }

  // Generate filename
  const timestamp = generateTimestamp();
  const branch = sanitizeForFilename(getBranchName());
  const desc = description ? `_${sanitizeForFilename(description)}` : '';
  const filename = `${timestamp}_${branch}${desc}.md`;
  const filePath = join(changelogDir, filename);

  // Write template
  const template = generateTemplate();
  writeFileSync(filePath, template);

  console.log(`Created changelog fragment: changelog.d/${filename}`);
  console.log('\nEdit this file to describe your changes.');
  console.log('Remove any sections that don\'t apply to your changes.');
}

main();
