#!/usr/bin/env node
/**
 * Re-run the failed jobs of a workflow run when the failure is a job that no hosted
 * runner ever picked up (issue #16).
 *
 * When GitHub cannot hand out a hosted runner (usually macOS arm64 under capacity
 * constraints), it gives up with "The job was not acquired by Runner of type hosted
 * even after multiple attempts". The job ends cancelled (sometimes failed) with no
 * steps and no runner, so no code ran, yet the build and release gates are skipped.
 *
 * Only such jobs trigger a re-run. A job that ran steps and failed is never re-run,
 * and a job cancelled by concurrency or by a person carries no such annotation.
 * `gh run rerun --failed` also re-runs the jobs that were skipped because of it, so
 * the build and release gates are evaluated again. After MAX_ATTEMPTS attempts the
 * script fails with the command a maintainer can run once capacity returns.
 *
 * Set CI_VERBOSE=true to print the annotations of every candidate job.
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const NOT_ACQUIRED = 'was not acquired by Runner';
export const MAX_ATTEMPTS = 3;

/** A candidate never reached a runner: cancelled or failed, no steps, no runner name. */
export function isCandidate(job) {
  return ['cancelled', 'failure'].includes(job.conclusion) && !job.runner_name && !(job.steps || []).length;
}

/** Names of candidate jobs whose check-run annotations say no runner acquired them. */
export function unacquiredJobs(jobs, annotations) {
  return jobs
    .filter(job => isCandidate(job) && (annotations.get(job.id) || []).some(message => message.includes(NOT_ACQUIRED)))
    .map(job => job.name);
}

/** Return "rerun", "give-up", or "nothing" for the given attempt. */
export function decide(names, attempt, maxAttempts = MAX_ATTEMPTS) {
  if (!names.length) return 'nothing';
  return attempt < maxAttempts ? 'rerun' : 'give-up';
}

/** Escape text for a workflow command so job names cannot inject commands. */
export function escapeCommandData(value) {
  return String(value).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
}

function parsePages(output) {
  // `gh api --paginate --slurp` wraps every page in one JSON array.
  return JSON.parse(output).flatMap(page => (Array.isArray(page) ? page : page.jobs || []));
}

export function run({ repository, runId, attempt, maxAttempts = MAX_ATTEMPTS, dryRun = false, verbose = false, api = gh, log = console.log, summary = () => {} }) {
  const jobs = parsePages(api(['api', '--paginate', '--slurp', `repos/${repository}/actions/runs/${runId}/attempts/${attempt}/jobs?per_page=100`]));
  const annotations = new Map();
  for (const job of jobs.filter(isCandidate)) {
    const found = parsePages(api(['api', '--paginate', '--slurp', `repos/${repository}/check-runs/${job.id}/annotations?per_page=100`]));
    annotations.set(job.id, found.map(annotation => annotation.message || ''));
    if (verbose) log(`${escapeCommandData(job.name)}: ${escapeCommandData(JSON.stringify(annotations.get(job.id)))}`);
  }
  const names = unacquiredJobs(jobs, annotations);
  const verdict = decide(names, attempt, maxAttempts);
  const listed = escapeCommandData(names.join(', '));
  const manual = `gh run rerun ${runId} --failed --repo ${repository}`;
  if (verdict === 'nothing') {
    log(`Attempt ${attempt}: every failed job reached a runner; nothing to re-run.`);
    summary(`Attempt ${attempt} of run ${runId}: no runner-acquisition failures; the run is left as it is.`);
    return 0;
  }
  if (verdict === 'give-up') {
    log(`::error title=Hosted runner not acquired::${listed} found no hosted runner in ${attempt} attempts. GitHub runner capacity is outside this repository: re-run later with \`${manual}\`.`);
    summary(`:x: **Hosted runner not acquired** after ${attempt} attempts: ${listed}. This is an infrastructure failure, not a code failure. Re-run later with \`${manual}\`.`);
    return 1;
  }
  log(`::warning title=Hosted runner not acquired::${listed} (attempt ${attempt}); re-running the failed jobs and the jobs that waited for them.`);
  summary(`:warning: **Hosted runner not acquired** in attempt ${attempt}: ${listed}. This is an infrastructure failure, not a code failure; the failed jobs were re-run.`);
  if (!dryRun) api(['run', 'rerun', String(runId), '--failed', '--repo', repository]);
  return 0;
}

function integer(name) {
  const value = Number(process.env[name]);
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
  return value;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const repository = process.env.REPOSITORY;
    if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '')) throw new Error('REPOSITORY must be owner/name');
    process.exitCode = run({
      repository,
      runId: integer('RUN_ID'),
      attempt: integer('ATTEMPT'),
      maxAttempts: process.env.MAX_ATTEMPTS ? integer('MAX_ATTEMPTS') : MAX_ATTEMPTS,
      dryRun: process.argv.includes('--dry-run'),
      verbose: process.env.CI_VERBOSE === 'true',
      summary: text => {
        if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Runner acquisition\n\n${text}\n`);
      },
    });
  } catch (error) {
    console.error(`::error title=Runner acquisition check failed::${escapeCommandData(error.message)}`);
    process.exitCode = 1;
  }
}
