#!/usr/bin/env node
/**
 * File size validation script.
 *
 * Checks that all Java and JavaScript files in the project do not exceed the maximum
 * allowed line count (1000 lines by default), warning from 900 lines.
 *
 * Usage:
 *   bun scripts/check-file-size.mjs [--max-lines <number>] [--verbose]
 */

import { parseArgs as parseCommandLine } from 'node:util';

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { printUntrusted } from './github-actions-log.mjs';

const MAX_LINES_DEFAULT = 1000;
const WARNING_LINES = 900;

/**
 * Parse command line arguments.
 */
function parseArgs() {
  const { values } = parseCommandLine({ options: {'max-lines': { type: 'string', default: String(MAX_LINES_DEFAULT) }, verbose: { type: 'boolean', default: false }} });
  const maxLines = Number(values['max-lines']);
  if (!Number.isSafeInteger(maxLines) || maxLines < 1) throw new Error('--max-lines must be a positive integer');
  const verbose = values.verbose;

  return { maxLines, verbose };
}

/**
 * Recursively find all Java and JavaScript files in a directory.
 * @param {string} dir - Directory to search
 * @param {string[]} files - Accumulator array
 * @returns {string[]} Array of file paths
 */
function findSourceFiles(dir, files = []) {
  const excludeDirs = ['target', 'node_modules', '.git', '.idea', 'build'];

  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);

      if (excludeDirs.includes(entry)) {
        continue;
      }

      try {
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          findSourceFiles(fullPath, files);
        } else if (['.java', '.mjs', '.js'].includes(extname(entry))) {
          files.push(fullPath);
        }
      } catch {
        // Skip files we can't stat
      }
    }
  } catch {
    // Skip directories we can't read
  }

  return files;
}

/**
 * Count lines in a file.
 * @param {string} filePath - Path to the file
 * @returns {number} Number of lines
 */
function countLines(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  if (!content) return 0;
  return content.split('\n').length - (content.endsWith('\n') ? 1 : 0);
}

/**
 * Main function.
 */
function main() {
  const { maxLines, verbose } = parseArgs();
  const projectRoot = process.cwd();

  console.log(`Checking Java and JavaScript files for maximum ${maxLines} lines...`);

  const sourceFiles = findSourceFiles(projectRoot);
  const violations = [];

  for (const file of sourceFiles) {
    const lineCount = countLines(file);
    const relativePath = file.replace(projectRoot + '/', '');

    if (verbose) {
      console.log(`  ${lineCount} lines:`);
      printUntrusted(relativePath);
    }

    if (lineCount > maxLines) {
      violations.push({ file: relativePath, lines: lineCount });
    } else if (lineCount >= WARNING_LINES) {
      // Escape workflow-command data so contributor-controlled filenames stay data.
      const safePath = relativePath.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
      console.log(`::warning title=File size warning::${safePath} has ${lineCount} lines (warning: ${WARNING_LINES}, max: ${maxLines}); consider splitting it.`);
    }
  }

  if (violations.length > 0) {
    console.error('\nFile size violations found:');
    for (const { file, lines } of violations) {
      console.error(`  ${lines} lines (max: ${maxLines}):`);
      printUntrusted(file);
    }
    console.error(`\nTotal violations: ${violations.length}`);
    process.exit(1);
  }

  console.log(`\nAll ${sourceFiles.length} files pass the size check.`);
  process.exit(0);
}

main();
