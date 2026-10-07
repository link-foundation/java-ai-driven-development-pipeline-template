#!/usr/bin/env node
import { appendFileSync, readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const notes = args[1] === 'create' ? readFileSync(0, 'utf8') : undefined;
appendFileSync(process.env.GH_TEST_LOG, JSON.stringify({ args, notes }) + '\n');
if (args[1] === 'view') {
  process.stdout.write(process.env.GH_TEST_STDOUT || '');
  process.stderr.write(process.env.GH_TEST_STDERR || '');
  process.exit(Number(process.env.GH_TEST_STATUS));
}
process.exit(0);
