#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import test from 'node:test';
import { checkDependencies, collectDependencies, findProblems, report } from '../scripts/check-ci-dependencies.mjs';

function workflows(t, yaml, suffix = 'yml') {
  const directory = mkdtempSync(join(tmpdir(), 'java-ci-dependencies-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  writeFileSync(join(directory, `workflow.${suffix}`), yaml);
  return collectDependencies(directory);
}

test('collects action versions, separately installed Bun, and immutable Actionlint', t => {
  const dependencies = workflows(t, `steps:
  - uses: actions/checkout@v7.0.1
  - uses: oven-sh/setup-bun@v2.2.0
    with:
      bun-version: '1.4.2'
  - uses: docker://rhysd/actionlint:1.7.12@sha256:${'a'.repeat(64)}
  - uses: ./local-action
`, 'yaml');
  assert.deepEqual(dependencies.map(({ repo, version, digest }) => ({ repo, version, digest })), [
    { repo: 'actions/checkout', version: 'v7.0.1', digest: undefined },
    { repo: 'oven-sh/setup-bun', version: 'v2.2.0', digest: undefined },
    { repo: 'rhysd/actionlint', version: 'v1.7.12', digest: `sha256:${'a'.repeat(64)}` },
    { repo: 'oven-sh/bun', version: 'bun-v1.4.2', digest: undefined },
  ]);
});

for (const declaration of [
  'uses: actions/checkout@v7',
  'uses: actions/checkout@main',
  'uses: actions/checkout@v7.0.1-beta',
  'uses: oven-sh/setup-bun@v2.2.0',
  'bun-version: latest',
  'uses: docker://rhysd/actionlint:1.7.12',
]) {
  test(`rejects mutable dependency: ${declaration}`, t => {
    assert.throws(() => workflows(t, `steps:\n  - ${declaration}\n`), /exact stable|pin/);
  });
}

test('detects stale actions and Bun even within the same major version', async () => {
  const dependencies = [
    { path: 'workflow.yml', repo: 'actions/checkout', version: 'v7.0.0' },
    { path: 'workflow.yml', repo: 'oven-sh/bun', version: 'bun-v1.4.1' },
  ];
  const errors = await checkDependencies(dependencies, repo => repo === 'oven-sh/bun' ? 'bun-v1.4.2' : 'v7.0.1');
  assert.equal(errors.length, 2);
  assert.match(errors[0], /v7\.0\.0.*v7\.0\.1/);
  assert.match(errors[1], /bun-v1\.4\.1.*bun-v1\.4\.2/);
});

test('detects mismatched Actionlint digests and caches repeated lookups', async () => {
  let requests = 0;
  let digestRequests = 0;
  const dependency = { path: 'workflow.yml', repo: 'rhysd/actionlint', version: 'v1.7.12', digest: `sha256:${'a'.repeat(64)}` };
  const errors = await checkDependencies([dependency, dependency], () => {
    requests++;
    return 'v1.7.12';
  }, () => {
    digestRequests++;
    return `sha256:${'b'.repeat(64)}`;
  });
  assert.equal(errors.length, 2);
  assert.match(errors[0], /digest does not match/);
  assert.equal(requests, 1);
  assert.equal(digestRequests, 1);
});

test('current versions and a matching image digest pass', async () => {
  const digest = `sha256:${'a'.repeat(64)}`;
  const errors = await checkDependencies([
    { path: 'workflow.yml', repo: 'rhysd/actionlint', version: 'v1.7.12', digest },
  ], () => 'v1.7.12', () => digest);
  assert.deepEqual(errors, []);
});

test('registry failures propagate instead of reporting dependencies current', async () => {
  await assert.rejects(checkDependencies([
    { path: 'workflow.yml', repo: 'actions/checkout', version: 'v7.0.1' },
  ], () => { throw new Error('HTTP 403: rate limited'); }), /rate limited/);
});

test('collects downloaded tools with their checksums and rejects missing or mutable pins', t => {
  const sha256 = 'c'.repeat(64);
  const dependencies = workflows(t, `env:\n  OSV_SCANNER_VERSION: v2.7.0\n  OSV_SCANNER_SHA256: ${sha256}\n`);
  assert.deepEqual(dependencies.map(({ repo, version, asset, sha256: checksum }) => ({ repo, version, asset, checksum })), [
    { repo: 'google/osv-scanner', version: 'v2.7.0', asset: 'osv-scanner_linux_amd64', checksum: sha256 },
  ]);
  assert.throws(() => workflows(t, 'env:\n  OSV_SCANNER_VERSION: v2.7.0\n'), /needs a OSV_SCANNER_SHA256/);
  assert.throws(() => workflows(t, `env:\n  OSV_SCANNER_VERSION: latest\n  OSV_SCANNER_SHA256: ${sha256}\n`), /exact stable/);
  assert.throws(() => workflows(t, 'env:\n  OSV_SCANNER_VERSION: v2.7.0\n  OSV_SCANNER_SHA256: abc\n'), /sha256 hex/);
});

test('downloaded tool checksums must match the release asset digest', async () => {
  const dependency = { path: 'workflow.yml', repo: 'google/osv-scanner', version: 'v2.7.0', asset: 'osv-scanner_linux_amd64', sha256: 'c'.repeat(64) };
  const problems = await findProblems([dependency], () => 'v2.7.0', undefined, () => 'd'.repeat(64));
  assert.deepEqual(problems.map(problem => problem.kind), ['broken']);
  assert.match(problems[0].message, /sha256 does not match/);
  assert.deepEqual(await findProblems([dependency], () => 'v2.7.0', undefined, () => 'c'.repeat(64)), []);
});

const outdated = { kind: 'outdated', message: 'workflow.yml: actions/checkout v7.0.0 is outdated; latest stable is v7.0.1' };
const broken = { kind: 'broken', message: 'workflow.yml: Actionlint v1.7.12 image digest does not match Docker Hub' };

test('outdated pins fail pull requests', () => {
  const result = report([outdated], 1, 'pull_request');
  assert.equal(result.exitCode, 1);
  assert.match(result.lines[0], /^::error title=Outdated CI dependency::.*v7\.0\.0 is outdated/);
});

for (const event of ['push', 'schedule', 'workflow_dispatch', undefined]) {
  test(`outdated pins only warn on ${event || 'local runs'}`, () => {
    const result = report([outdated], 1, event);
    assert.equal(result.exitCode, 0);
    assert.match(result.lines[0], /^::warning title=Outdated CI dependency::/);
    assert.match(result.summary, /:warning: .*is outdated/);
  });
}

for (const event of ['pull_request', 'push', 'schedule']) {
  test(`mismatched digests fail on ${event}`, () => {
    const result = report([broken, outdated], 2, event);
    assert.equal(result.exitCode, 1);
    assert.match(result.lines[0], /^::error title=CI dependency pin mismatch::/);
  });
}

test('current pins pass with a summary', () => {
  const result = report([], 3, 'push');
  assert.equal(result.exitCode, 0);
  assert.deepEqual(result.lines, ['All 3 CI dependency declarations match their latest stable releases.']);
});

test('the script gates a stale pin by event end to end', t => {
  const directory = mkdtempSync(join(tmpdir(), 'java-ci-dependencies-e2e-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const workflowsDirectory = join(directory, 'workflows');
  const bin = join(directory, 'bin');
  mkdirSync(workflowsDirectory);
  mkdirSync(bin);
  writeFileSync(join(workflowsDirectory, 'ci.yml'), 'steps:\n  - uses: actions/checkout@v7.0.0\n');
  // A fake `gh` that reports a newer stable release, so no network is needed.
  const fakeGh = join(bin, 'gh');
  writeFileSync(fakeGh, `#!${process.execPath}\nprocess.stdout.write(JSON.stringify({ tag_name: 'v7.0.1', draft: false, prerelease: false }));\n`);
  chmodSync(fakeGh, 0o755);
  const script = resolve(import.meta.dirname, '..', 'scripts', 'check-ci-dependencies.mjs');
  const run = (event) => spawnSync(process.execPath, [script], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH}`, CI_DEPENDENCIES_WORKFLOW_DIRECTORY: workflowsDirectory, GITHUB_EVENT_NAME: event, GITHUB_STEP_SUMMARY: join(directory, `summary-${event}.md`) },
  });

  const pullRequest = run('pull_request');
  assert.equal(pullRequest.status, 1, pullRequest.stdout + pullRequest.stderr);
  assert.match(pullRequest.stdout, /::error title=Outdated CI dependency::.*v7\.0\.0 is outdated; latest stable is v7\.0\.1/);

  for (const event of ['push', 'schedule']) {
    const result = run(event);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /::warning title=Outdated CI dependency::.*v7\.0\.0 is outdated/);
    assert.match(readFileSync(join(directory, `summary-${event}.md`), 'utf8'), /## CI dependency freshness/);
  }
});
