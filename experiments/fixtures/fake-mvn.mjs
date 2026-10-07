#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

if (process.env.MVN_TEST_FAIL === '1') process.exit(1);
const args = process.argv.slice(2);
const source = args.includes('-f') ? dirname(args[args.indexOf('-f') + 1]) : process.cwd();
const version = readFileSync(join(source, 'pom.xml'), 'utf8').match(/<version>([^<]+)<\/version>/)[1];
const content = readFileSync(join(source, 'source.txt'), 'utf8');
mkdirSync(join(source, 'target'), { recursive: true });
for (const suffix of ['', '-sources', '-javadoc']) {
  writeFileSync(join(source, 'target', `my-package-${version}${suffix}.jar`), content);
}
