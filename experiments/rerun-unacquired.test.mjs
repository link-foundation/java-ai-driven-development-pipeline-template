#!/usr/bin/env node
import assert from 'node:assert/strict';
import test from 'node:test';
import { decide, escapeCommandData, run, unacquiredJobs } from '../scripts/rerun-unacquired.mjs';

const NOT_ACQUIRED = 'The job was not acquired by Runner of type hosted even after multiple attempts';
// Shapes taken from link-foundation/links-notation run 41477660740, attempt 1.
const unacquired = { id: 1, name: 'Test (Java 21, macos-26)', conclusion: 'cancelled', runner_name: '', steps: [] };
const realFailure = { id: 2, name: 'Test (Java 21, ubuntu-24.04)', conclusion: 'failure', runner_name: 'GitHub Actions 7', steps: [{ name: 'Run tests' }] };
const concurrencyCancelled = { id: 3, name: 'Lint & Format', conclusion: 'cancelled', runner_name: '', steps: [] };
const skipped = { id: 4, name: 'Build Package', conclusion: 'skipped', runner_name: '', steps: [] };

test('only jobs with no runner, no steps, and the not-acquired annotation qualify', () => {
  const annotations = new Map([[1, [NOT_ACQUIRED]], [2, [NOT_ACQUIRED]], [3, ['Canceling since a higher priority waiting request exists']]]);
  assert.deepEqual(unacquiredJobs([unacquired, realFailure, concurrencyCancelled, skipped], annotations), ['Test (Java 21, macos-26)']);
  assert.deepEqual(unacquiredJobs([{ ...unacquired, conclusion: 'failure' }], annotations), ['Test (Java 21, macos-26)']);
});

test('reruns at most twice, then gives up', () => {
  assert.equal(decide([], 1), 'nothing');
  assert.equal(decide(['macos'], 1), 'rerun');
  assert.equal(decide(['macos'], 2), 'rerun');
  assert.equal(decide(['macos'], 3), 'give-up');
});

function fakeApi(jobs, annotations) {
  const calls = [];
  const api = args => {
    calls.push(args);
    const path = args.find(arg => arg.startsWith('repos/'));
    if (args[0] === 'run') return '';
    if (path.includes('/jobs')) return JSON.stringify([{ total_count: jobs.length, jobs }]);
    const id = Number(path.match(/check-runs\/(\d+)\//)[1]);
    return JSON.stringify([(annotations[id] || []).map(message => ({ message }))]);
  };
  return { api, calls };
}

test('reruns failed jobs once a runner was not acquired', () => {
  const { api, calls } = fakeApi([unacquired, skipped], { 1: [NOT_ACQUIRED] });
  const lines = [];
  const summaries = [];
  assert.equal(run({ repository: 'o/r', runId: 42, attempt: 1, api, log: line => lines.push(line), summary: text => summaries.push(text) }), 0);
  assert.deepEqual(calls.at(-1), ['run', 'rerun', '42', '--failed', '--repo', 'o/r']);
  assert.match(lines.at(-1), /^::warning title=Hosted runner not acquired::Test \(Java 21, macos-26\)/);
  assert.match(summaries[0], /infrastructure failure, not a code failure/);
});

test('never reruns a run whose jobs ran and failed', () => {
  const { api, calls } = fakeApi([realFailure, concurrencyCancelled], { 3: ['Canceling since a higher priority waiting request exists'] });
  assert.equal(run({ repository: 'o/r', runId: 42, attempt: 1, api, log: () => {} }), 0);
  assert.ok(!calls.some(args => args[0] === 'run'));
  assert.ok(!calls.some(args => args.some(arg => arg.includes('check-runs/2/'))), 'jobs that ran are not even inspected');
});

test('fails with the manual command after the last attempt', () => {
  const { api, calls } = fakeApi([unacquired], { 1: [NOT_ACQUIRED] });
  const lines = [];
  assert.equal(run({ repository: 'o/r', runId: 42, attempt: 3, api, log: line => lines.push(line) }), 1);
  assert.ok(!calls.some(args => args[0] === 'run'));
  assert.match(lines.at(-1), /::error title=Hosted runner not acquired::.*gh run rerun 42 --failed --repo o\/r/);
});

test('job names cannot inject workflow commands', () => {
  assert.equal(escapeCommandData('a\n::error::x%'), 'a%0A::error::x%25');
});
