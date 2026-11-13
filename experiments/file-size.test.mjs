import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const script = resolve(import.meta.dirname, '../scripts/check-file-size.mjs');
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'file-size-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}
function run(directory, args = []) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: directory, encoding: 'utf8', timeout: 10000,
  });
}

for (const extension of ['java', 'mjs', 'js']) {
  for (const lines of [899, 900, 999, 1000, 1001]) {
    test(`${extension}: ${lines} lines respects warning and failure boundaries`, t => {
      const directory = fixture(t);
      mkdirSync(join(directory, 'nested'));
      writeFileSync(join(directory, 'nested', `source.${extension}`), '// line\n'.repeat(lines));
      const result = run(directory);
      assert.equal(result.status, lines > 1000 ? 1 : 0, result.stdout + result.stderr);
      if (lines >= 900 && lines <= 1000) {
        assert.match(result.stdout, /::warning title=File size warning::.*source\./);
        assert.match(result.stdout, new RegExp(`${lines} lines`));
      } else {
        assert.doesNotMatch(result.stdout, /::warning/);
      }
    });
  }
}

test('ignores generated directories and unrelated files, and preserves custom limits', t => {
  const directory = fixture(t);
  for (const excluded of ['target', 'node_modules', '.git', '.idea', 'build']) {
    mkdirSync(join(directory, excluded));
    writeFileSync(join(directory, excluded, 'large.mjs'), '// line\n'.repeat(1001));
  }
  writeFileSync(join(directory, 'notes.md'), 'line\n'.repeat(1001));
  writeFileSync(join(directory, 'small.js'), '// line\n'.repeat(11));
  assert.equal(run(directory).status, 0);
  assert.equal(run(directory, ['--max-lines', '10']).status, 1);
});

test('counts an unterminated last line and escapes contributor filenames in annotations', t => {
  const directory = fixture(t);
  writeFileSync(join(directory, 'source%\n::error::injected.js'), '// line\n'.repeat(899) + '// last');
  const result = run(directory);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /::warning title=File size warning::.*source%25%0A::error::injected.js.*900 lines/);
  assert.doesNotMatch(result.stdout, /^::error::injected/m);
});
