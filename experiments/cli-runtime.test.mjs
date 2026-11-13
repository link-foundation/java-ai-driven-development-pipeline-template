import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const run = (script, args, options = {}) => spawnSync(process.execPath, [join(root, 'scripts', script), ...args], {
  encoding: 'utf8', timeout: 10000, ...options,
});

test('every CI script parses under Node.js, including bump-version', { timeout: 10000 }, () => {
  for (const file of readdirSync(join(root, 'scripts')).filter(file => file.endsWith('.mjs'))) {
    const result = spawnSync(process.execPath, ['--check', join(root, 'scripts', file)], { encoding: 'utf8', timeout: 5000 });
    assert.equal(result.status, 0, result.stderr);
  }
});

test('bump-version accepts native equals syntax and writes the version and Actions output', t => {
  const cwd = mkdtempSync(join(tmpdir(), 'cli-runtime-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  mkdirSync(join(cwd, 'src/main/java/com/linkfoundation/mypackage'), { recursive: true });
  writeFileSync(join(cwd, 'pom.xml'), '<project><version>1.2.3</version></project>');
  const javaPath = join(cwd, 'src/main/java/com/linkfoundation/mypackage/MyPackage.java');
  writeFileSync(javaPath, 'class MyPackage { static final String VERSION = "1.2.3"; }');
  const output = join(cwd, 'output');
  const result = run('bump-version.mjs', ['--bump-type=minor'], { cwd, env: { ...process.env, GITHUB_OUTPUT: output } });
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(join(cwd, 'pom.xml'), 'utf8'), /<version>1.3.0<\/version>/);
  assert.match(readFileSync(javaPath, 'utf8'), /VERSION = "1.3.0"/);
  assert.equal(readFileSync(output, 'utf8'), 'new_version=1.3.0\n');
});

test('native parsing rejects missing values and misspelled release options before writing', () => {
  for (const args of [['--bump-type'], ['--bump-typo', 'patch']]) {
    const result = run('bump-version.mjs', args);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /ERR_PARSE_ARGS/);
  }
});
