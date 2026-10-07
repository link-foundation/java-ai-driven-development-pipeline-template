#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const cases = [
  ['missing release', 1, 'release not found\n', true, 'true'],
  ['existing release', 0, '', true, 'false'],
  ['authentication failure', 1, 'HTTP 401: Bad credentials\n', true, 'false'],
  ['network failure', 1, 'dial tcp: connection refused\n', true, 'false'],
  ['rate limit', 1, 'HTTP 403: API rate limit exceeded\n', true, 'false'],
  ['server failure', 1, 'HTTP 502: Bad Gateway\n', true, 'false'],
  ['unexpected exit code', 2, 'release not found\n', true, 'false'],
  ['ambiguous failure', 1, 'release not found\nHTTP 500: server failure\n', true, 'false'],
  ['missing tag', 1, 'release not found\n', false, 'false'],
];

function fixture(t, { status = 1, stderr = 'release not found\n', tagged = true } = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'java-release-recovery-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  mkdirSync(join(cwd, '.changeset'));
  mkdirSync(join(cwd, 'bin'));
  writeFileSync(join(cwd, 'pom.xml'), '<project><version>1.2.3</version></project>\n');
  writeFileSync(join(cwd, 'CHANGELOG.md'), '# Changelog\n\n## [1.2.3]\n\nRecovered notes.\n\n## [1.2.2]\n\nOlder notes.\n');
  const gh = join(cwd, 'bin', 'gh');
  copyFileSync(join(root, 'experiments', 'fixtures', 'fake-gh.mjs'), gh);
  chmodSync(gh, 0o755);
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  git('init', '-q');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'Test');
  git('add', '.');
  git('commit', '-qm', 'released version');
  if (tagged) git('tag', 'v1.2.3');
  const env = {
    ...process.env,
    PATH: `${join(cwd, 'bin')}:${process.env.PATH}`,
    GITHUB_OUTPUT: join(cwd, 'output'),
    GITHUB_REPOSITORY: 'example/repository',
    GH_TEST_LOG: join(cwd, 'gh-calls'),
    GH_TEST_STATUS: String(status),
    GH_TEST_STDERR: stderr,
  };
  const run = (script, args = []) => spawnSync(process.execPath, [join(root, 'scripts', script), ...args], {
    cwd, env, encoding: 'utf8', timeout: 10000,
  });
  const calls = () => existsSync(env.GH_TEST_LOG)
    ? readFileSync(env.GH_TEST_LOG, 'utf8').trim().split('\n').map(JSON.parse) : [];
  const outputs = () => Object.fromEntries(readFileSync(env.GITHUB_OUTPUT, 'utf8').trim().split('\n').map(line => line.split('=')));
  return { cwd, git, run, calls, outputs };
}

for (const [name, status, stderr, tagged, released] of cases) {
  test(`changeset release recovery: ${name}`, { timeout: 15000 }, t => {
    const f = fixture(t, { status, stderr, tagged });
    const before = f.git('rev-parse', 'HEAD');
    const result = f.run('version-and-commit.mjs', ['--mode', 'changeset']);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(f.outputs().released, released, result.stdout);
    assert.equal(f.git('rev-parse', 'HEAD'), before, 'recovery must not commit');
    assert.equal(readFileSync(join(f.cwd, 'pom.xml'), 'utf8'), '<project><version>1.2.3</version></project>\n');
    assert.equal(f.git('tag'), tagged ? 'v1.2.3' : '', 'recovery must not create tags');
    if (tagged) assert.deepEqual(f.calls()[0]?.args, ['release', 'view', 'v1.2.3', '--repo', 'example/repository']);
    if (released === 'true') {
      assert.equal(f.outputs().skip_bump, 'true');
      assert.equal(f.outputs().new_version, '1.2.3');
    } else if (status !== 0 && tagged) {
      assert.match(result.stderr, /::warning::/);
      assert.equal(f.outputs().already_released, 'false', 'unknown status is not already released');
    }
  });
}

test('recovery creates the existing tag release with its changelog section', { timeout: 15000 }, t => {
  const f = fixture(t);
  assert.equal(f.run('version-and-commit.mjs', ['--mode', 'changeset']).status, 0);
  const result = f.run('create-github-release.mjs', ['--release-version', '1.2.3', '--repository', 'example/repository']);
  assert.equal(result.status, 0, result.stderr);
  const create = f.calls().find(call => call.args[1] === 'create');
  assert.ok(create, 'missing release must be created');
  assert.ok(create.args.includes('--verify-tag'), 'creation must require an existing remote tag');
  assert.equal(create.notes, 'Recovered notes.');
});

test('release creation fails on an unknown lookup rather than treating it as missing', { timeout: 15000 }, t => {
  const f = fixture(t, { status: 1, stderr: 'HTTP 403: Forbidden\n' });
  const result = f.run('create-github-release.mjs', ['--release-version', '1.2.3', '--repository', 'example/repository']);
  assert.equal(result.status, 1, result.stdout);
  assert.equal(f.calls().filter(call => call.args[1] === 'create').length, 0);
});

test('an existing release is left alone', { timeout: 15000 }, t => {
  const f = fixture(t, { status: 0, stderr: '' });
  const result = f.run('create-github-release.mjs', ['--release-version', '1.2.3', '--repository', 'example/repository']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(f.calls().filter(call => call.args[1] === 'create').length, 0);
});

for (const fail of [false, true]) {
  test(`recovery build uses tagged source and removes its worktree${fail ? ' after Maven fails' : ''}`, { timeout: 15000 }, t => {
    const f = fixture(t, { tagged: false });
    writeFileSync(join(f.cwd, 'source.txt'), 'original released source\n');
    f.git('add', 'source.txt');
    f.git('commit', '-qm', 'original source');
    f.git('tag', 'v1.2.3');
    writeFileSync(join(f.cwd, 'source.txt'), 'later unreleased source\n');
    f.git('add', 'source.txt');
    f.git('commit', '-qm', 'later source');
    const before = f.git('rev-parse', 'HEAD');
    const mvn = join(f.cwd, 'bin', 'mvn');
    copyFileSync(join(root, 'experiments', 'fixtures', 'fake-mvn.mjs'), mvn);
    chmodSync(mvn, 0o755);
    const workflow = readFileSync(join(root, '.github', 'workflows', 'release.yml'), 'utf8')
      .split('\n  manual-release-instant:\n')[0];
    const blocks = [...workflow.matchAll(/- name: Build release artifacts[\s\S]*?        run: \|\n([\s\S]*?)(?=\n      - name:)/g)];
    assert.equal(blocks.length, 2, 'auto and manual changeset builds must support recovery');
    for (const [, body] of blocks) {
      const result = spawnSync('bash', ['-e', '-c', body.replace(/^          /gm, '')], {
        cwd: f.cwd, encoding: 'utf8', timeout: 10000,
        env: { ...process.env, PATH: `${join(f.cwd, 'bin')}:${process.env.PATH}`, SKIP_BUMP: 'true', RELEASE_VERSION: '1.2.3', MVN_TEST_FAIL: fail ? '1' : '0' },
      });
      assert.equal(result.status, fail ? 1 : 0, result.stderr);
      assert.equal(f.git('worktree', 'list', '--porcelain').match(/^worktree /gm).length, 1);
      assert.equal(f.git('rev-parse', 'HEAD'), before);
      if (!fail) {
        for (const suffix of ['', '-sources', '-javadoc']) {
          assert.equal(readFileSync(join(f.cwd, 'target', `my-package-1.2.3${suffix}.jar`), 'utf8'), 'original released source\n');
        }
      }
    }
  });
}

for (const mode of ['changeset', 'instant']) {
  test(`normal ${mode} releases still bump, commit and push`, { timeout: 15000 }, t => {
    const f = fixture(t, { tagged: false });
    mkdirSync(join(f.cwd, 'scripts'));
    for (const file of ['collect-changelog.mjs', 'github-actions-log.mjs']) {
      copyFileSync(join(root, 'scripts', file), join(f.cwd, 'scripts', file));
    }
    if (mode === 'changeset') {
      writeFileSync(join(f.cwd, '.changeset', 'fix.md'), "---\n'my-package': patch\n---\n\nNormal patch release.\n");
    }
    f.git('add', '.');
    f.git('commit', '-qm', 'release inputs');
    f.git('init', '--bare', '-q', join(f.cwd, 'remote.git'));
    f.git('remote', 'add', 'origin', join(f.cwd, 'remote.git'));
    f.git('push', '-u', 'origin', 'HEAD');
    const args = ['--mode', mode];
    if (mode === 'instant') args.push('--bump-type', 'patch');
    const result = f.run('version-and-commit.mjs', args);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.equal(f.outputs().released, 'true');
    assert.equal(f.outputs().skip_bump, 'false');
    assert.equal(f.outputs().new_version, '1.2.4');
    assert.match(readFileSync(join(f.cwd, 'pom.xml'), 'utf8'), /<version>1\.2\.4<\/version>/);
    assert.equal(f.git('tag'), 'v1.2.4');
    assert.equal(f.git('log', '-1', '--format=%s'), 'chore: release v1.2.4');
    assert.match(f.git('ls-remote', '--tags', 'origin'), /refs\/tags\/v1\.2\.4/);
    assert.equal(existsSync(join(f.cwd, '.changeset', 'fix.md')), false);
    assert.equal(f.calls().length, 0, 'new releases must not depend on a recovery lookup');
  });
}
