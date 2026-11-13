#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const workflowPath = resolve(import.meta.dirname, '..', '.github', 'workflows', 'release.yml');
const workflow = readFileSync(workflowPath, 'utf8');
const workflowDirectory = resolve(import.meta.dirname, '..', '.github', 'workflows');
const workflows = readdirSync(workflowDirectory)
  .filter(name => /\.ya?ml$/.test(name))
  .map(name => readFileSync(resolve(workflowDirectory, name), 'utf8'));

function runBlocks(yaml) {
  const lines = yaml.split('\n');
  const blocks = [];
  for (let index = 0; index < lines.length; index++) {
    const inline = lines[index].match(/^(\s*)run:\s+([^|>].*)$/);
    if (inline) {
      blocks.push(inline[2]);
      continue;
    }
    const scalar = lines[index].match(/^(\s*)run:\s*[|>][-+]?\s*$/);
    if (!scalar) continue;
    const indentation = scalar[1].length;
    const body = [];
    while (++index < lines.length) {
      const line = lines[index];
      if (line.trim() && line.length - line.trimStart().length <= indentation) {
        index--;
        break;
      }
      body.push(line);
    }
    blocks.push(body.join('\n'));
  }
  return blocks;
}

test('dispatch inputs are never interpolated directly into run scripts', () => {
  for (const block of runBlocks(workflow)) {
    assert.doesNotMatch(block, /\$\{\{\s*(?:inputs|github\.event\.inputs)\./);
  }
});

test('release workflow has the required cancellation and writer serialization policy', () => {
  assert.doesNotMatch(workflow, /^concurrency:/m, 'workflow-level concurrency can cancel writers');
  assert.equal((workflow.match(/!cancelled\(\)/g) || []).length, 2);
  assert.equal((workflow.match(/group: main-writer-\$\{\{ github\.repository \}\}-main/g) || []).length, 4);
  assert.equal((workflow.match(/queue: max/g) || []).length, 4);
  assert.equal((workflow.match(/cancel-in-progress: true/g) || []).length, 5);
});

test('Codecov upload is explicit, current, gated, and fail-closed', () => {
  assert.match(workflow, /uses: codecov\/codecov-action@v7/);
  assert.match(workflow, /files: target\/site\/jacoco\/jacoco\.xml/);
  assert.match(workflow, /disable_search: true/);
  assert.match(workflow, /fail_ci_if_error: true/);
  assert.match(workflow, /env\.CODECOV_TOKEN != ''/);
});

test('every release path verifies uploaded artifacts', () => {
  assert.equal((workflow.match(/name: Verify published release artifacts/g) || []).length, 3);
  assert.doesNotMatch(workflow, /gh release upload[^\n]*\|\| true/);
});

test('GitHub output-file redirections are quoted', () => {
  assert.doesNotMatch(workflow, />>\s+\$GITHUB_OUTPUT/);
});

test('changeset release jobs run the version script even with no changesets', () => {
  const autoRelease = workflow.split('\n  auto-release:\n')[1].split('\n  manual-release-changeset:\n')[0];
  assert.doesNotMatch(autoRelease, /if: steps\.changesets\.outputs\.has_changesets == 'true'\s+id: release/);
  assert.match(autoRelease, /id: release\s+run: bun scripts\/version-and-commit\.mjs --mode changeset/);
});

test('recovery builds artifacts from the original release tag', () => {
  const changesetJobs = workflow.split('\n  auto-release:\n')[1].split('\n  manual-release-instant:\n')[0];
  assert.equal((changesetJobs.match(/steps\.release\.outputs\.skip_bump/g) || []).length, 2);
  assert.equal((changesetJobs.match(/git worktree add --detach/g) || []).length, 2);
});

test('all hosted runner images are explicit, including matrix entries', () => {
  for (const yaml of workflows) {
    assert.doesNotMatch(yaml, /^\s*(?:runs-on:|os:|-)\s+.*\b(?:ubuntu|windows|macos)-latest\b/m);
  }
});

test('Bun and Actionlint use explicit versions and the Actionlint image has a digest', () => {
  for (const yaml of workflows) {
    for (const [, version] of yaml.matchAll(/bun-version:\s*['"]?([^\s'"#]+)/g)) {
      assert.match(version, /^\d+\.\d+\.\d+$/);
    }
    for (const [, image] of yaml.matchAll(/uses:\s*(docker:\/\/rhysd\/actionlint[^\s]+)/g)) {
      assert.match(image, /^docker:\/\/rhysd\/actionlint:\d+\.\d+\.\d+@sha256:[a-f0-9]{64}$/);
    }
  }
});

test('dependency freshness runs in CI and on a schedule', () => {
  assert.ok(workflows.some(yaml => /schedule:/.test(yaml) && /node scripts\/check-ci-dependencies\.mjs/.test(yaml)));
});

function readRepositoryFile(...parts) {
  return readFileSync(resolve(import.meta.dirname, '..', ...parts), 'utf8');
}

test('Dependabot proposes Maven, GitHub Actions and pre-commit updates weekly with a cooldown', () => {
  const dependabot = readRepositoryFile('.github', 'dependabot.yml');
  for (const ecosystem of ['maven', 'github-actions', 'pre-commit']) {
    const entry = dependabot.split(/\n  - package-ecosystem: /).find(block => block.startsWith(`${ecosystem}\n`));
    assert.ok(entry, `${ecosystem} is configured`);
    assert.match(entry, /directory: \/\n/);
    assert.match(entry, /interval: weekly/);
    assert.match(entry, /default-days: 7/);
  }
});

test('plugin versions stay in properties and requireMavenVersion stays a range', () => {
  const pom = readRepositoryFile('pom.xml');
  const plugins = [...pom.matchAll(/<plugin>([\s\S]*?)<\/plugin>/g)].map(match => match[1].replace(/<configuration>[\s\S]*?<\/configuration>/g, ''));
  for (const plugin of plugins) assert.match(plugin, /<version>\$\{[\w.-]+\.version\}<\/version>/);
  assert.match(pom, /<requireMavenVersion>\s*<version>\[3\.10\.0,\)<\/version>/);
});

test('the security workflow audits Maven dependencies and plugins on PRs, main, and a schedule', () => {
  const security = readRepositoryFile('.github', 'workflows', 'security.yml');
  for (const trigger of ['pull_request:', 'push:', 'schedule:', 'workflow_dispatch:']) assert.match(security, new RegExp(`^  ${trigger}`, 'm'));
  assert.match(security, /^permissions:\n  contents: read/m);
  assert.match(security, /OSV_SCANNER_VERSION: v\d+\.\d+\.\d+\n/);
  assert.match(security, /OSV_SCANNER_SHA256: [a-f0-9]{64}\n/);
  assert.match(security, /curl -fsSL --retry 3 --retry-all-errors --retry-delay 5 --connect-timeout 20/);
  assert.match(security, /sha256sum --check --strict/);
  assert.match(security, /osv-scanner scan source -L pom\.xml/);
  assert.match(security, /node scripts\/audit-maven-plugins\.mjs pom\.xml/);
  assert.match(security, /persist-credentials: false/);
});

test('runner-acquisition failures are re-run for every CI workflow, with least privilege', () => {
  const rerun = readRepositoryFile('.github', 'workflows', 'rerun-unacquired.yml');
  const watched = JSON.parse(`[${rerun.match(/workflows: \[(.*)\]/)[1].replace(/'/g, '"')}]`);
  const names = readdirSync(workflowDirectory)
    .filter(name => /\.ya?ml$/.test(name) && name !== 'rerun-unacquired.yml')
    .map(name => readFileSync(resolve(workflowDirectory, name), 'utf8').match(/^name: (.+)$/m)[1]);
  assert.deepEqual([...watched].sort(), [...names].sort());
  assert.match(rerun, /^permissions:\n  contents: read\n/m);
  assert.match(rerun, /actions: write/);
  assert.match(rerun, /head_repository\.full_name == github\.repository/);
  assert.match(rerun, /persist-credentials: false/);
  assert.match(rerun, /run: node scripts\/rerun-unacquired\.mjs/);
  assert.doesNotMatch(rerun, /\$\{\{ github\.event\.workflow_run\.(?:head_branch|display_title|head_commit)/);
});
