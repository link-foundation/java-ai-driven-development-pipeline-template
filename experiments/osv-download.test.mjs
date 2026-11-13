import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

// Run the actual installation block against a bounded local server. The first
// response ends before Content-Length bytes arrive (curl error 18); retry succeeds.
test('OSV installation retries a partial transfer and verifies the downloaded checksum', { timeout: 20000 }, async t => {
  const directory = mkdtempSync(join(tmpdir(), 'osv-download-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const binary = '#!/bin/sh\necho scanner\n';
  let requests = 0;
  const server = createServer((request, response) => {
    requests++;
    response.setHeader('Content-Length', Buffer.byteLength(binary));
    response.setHeader('Connection', 'close');
    response.end(requests === 1 ? binary.slice(0, 5) : binary);
  });
  t.after(() => server.close());
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const workflow = readFileSync(new URL('../.github/workflows/security.yml', import.meta.url), 'utf8');
  const script = workflow.split('      - name: Install OSV-Scanner\n')[1]
    .split('        run: |\n')[1].split('\n      - name:')[0]
    .replace('https://github.com/google/osv-scanner/releases/download/${OSV_SCANNER_VERSION}/osv-scanner_linux_amd64',
      `http://127.0.0.1:${server.address().port}/scanner`);
  const child = spawn('bash', ['-c', script], {
    env: { ...process.env, RUNNER_TEMP: directory, GITHUB_PATH: join(directory, 'path'),
      OSV_SCANNER_SHA256: createHash('sha256').update(binary).digest('hex') },
    timeout: 15000,
  });
  t.after(() => { if (child.exitCode === null) child.kill(); });
  let output = '';
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { output += data; });
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
  assert.equal(code, 0, output);
  assert.equal(requests, 2, output);
  assert.match(output, /curl: \(18\)/);
  assert.match(output, /: OK/);
  assert.equal(readFileSync(join(directory, 'osv-scanner', 'osv-scanner'), 'utf8'), binary);
});
