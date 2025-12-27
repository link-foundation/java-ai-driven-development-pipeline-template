#!/usr/bin/env node
/**
 * Changelog fragment validation script.
 *
 * Validates that PR contains a proper changelog fragment file
 * in the changelog.d/ directory.
 *
 * Usage:
 *   bun scripts/validate-changeset.mjs
 */

import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

/**
 * Get list of files changed in current PR.
 * @returns {string[]} Array of changed file paths
 */
function getChangedFiles() {
  try {
    // Try to get files from PR diff
    const baseBranch = process.env.GITHUB_BASE_REF || 'main';
    const output = execSync(
      `git diff --name-only origin/${baseBranch}...HEAD`,
      { encoding: 'utf-8' }
    );
    return output.trim().split('\n').filter(Boolean);
  } catch {
    // Fallback: get all staged/unstaged changes
    try {
      const output = execSync('git diff --name-only HEAD', { encoding: 'utf-8' });
      return output.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }
}

/**
 * Check if PR contains source code changes.
 * @param {string[]} changedFiles - List of changed files
 * @returns {boolean} True if source files were changed
 */
function hasSourceChanges(changedFiles) {
  const sourcePatterns = [
    /^src\//,
    /^tests\//,
    /^examples\//,
    /^scripts\//,
    /^pom\.xml$/,
  ];

  return changedFiles.some((file) =>
    sourcePatterns.some((pattern) => pattern.test(file))
  );
}

/**
 * Find changelog fragment files in the changelog.d directory.
 * @param {string} changelogDir - Path to changelog.d
 * @returns {string[]} Array of fragment file names
 */
function findFragments(changelogDir) {
  if (!existsSync(changelogDir)) {
    return [];
  }

  return readdirSync(changelogDir).filter(
    (file) => file.endsWith('.md') && file !== 'README.md'
  );
}

/**
 * Validate fragment content.
 * @param {string} fragmentPath - Path to fragment file
 * @returns {object} Validation result { valid: boolean, message: string }
 */
function validateFragmentContent(fragmentPath) {
  const content = readFileSync(fragmentPath, 'utf-8').trim();

  if (!content) {
    return { valid: false, message: 'Fragment file is empty' };
  }

  // Check for category headers
  const categories = [
    '### Added',
    '### Changed',
    '### Deprecated',
    '### Removed',
    '### Fixed',
    '### Security',
  ];

  const hasCategory = categories.some((cat) => content.includes(cat));
  if (!hasCategory) {
    return {
      valid: false,
      message: 'Fragment must include at least one category (### Added, ### Changed, etc.)',
    };
  }

  // Check for actual content (not just template)
  const lines = content.split('\n').filter(
    (line) => line.trim() && !line.startsWith('#')
  );

  if (lines.length === 0) {
    return { valid: false, message: 'Fragment has no content under category headers' };
  }

  // Check that content isn't template placeholder
  if (content.includes('Add your changes here')) {
    return { valid: false, message: 'Fragment contains template placeholder text' };
  }

  return { valid: true, message: 'Fragment is valid' };
}

/**
 * Main function.
 */
function main() {
  const projectRoot = process.cwd();
  const changelogDir = join(projectRoot, 'changelog.d');

  console.log('Validating changelog fragments...\n');

  // Get changed files
  const changedFiles = getChangedFiles();
  console.log(`Changed files: ${changedFiles.length}`);

  // Check if this is a source change that requires changelog
  if (!hasSourceChanges(changedFiles)) {
    console.log('\nNo source code changes detected. Changelog fragment not required.');
    process.exit(0);
  }

  console.log('Source code changes detected. Checking for changelog fragment...\n');

  // Check for changelog fragment in changed files
  const changelogChanges = changedFiles.filter((file) =>
    file.startsWith('changelog.d/') && file.endsWith('.md') && !file.endsWith('README.md')
  );

  if (changelogChanges.length === 0) {
    console.warn('WARNING: No changelog fragment found in this PR.');
    console.warn('\nPlease create a changelog fragment file in changelog.d/');
    console.warn('Example: changelog.d/20241201_120000_my_change.md');
    console.warn('\nSee changelog.d/README.md for format instructions.');

    // Exit with warning (0) not error, to not block PR
    // Change to process.exit(1) if you want to enforce fragments
    process.exit(0);
  }

  // Validate each fragment
  let allValid = true;
  for (const fragmentFile of changelogChanges) {
    const fragmentPath = join(projectRoot, fragmentFile);
    console.log(`Validating: ${fragmentFile}`);

    const result = validateFragmentContent(fragmentPath);
    if (result.valid) {
      console.log(`  OK: ${result.message}`);
    } else {
      console.error(`  ERROR: ${result.message}`);
      allValid = false;
    }
  }

  if (!allValid) {
    console.error('\nSome changelog fragments have validation errors.');
    process.exit(1);
  }

  console.log('\nAll changelog fragments are valid!');
  process.exit(0);
}

main();
