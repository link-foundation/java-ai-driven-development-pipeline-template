#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { checkDependencies, collectDependencies } from '../scripts/check-ci-dependencies.mjs';

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
