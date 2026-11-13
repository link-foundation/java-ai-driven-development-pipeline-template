// Reproduce OSV-Scanner's Maven scope coverage without adding a vulnerable dependency.
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const directory = mkdtempSync(join(tmpdir(), 'osv-scope-'));
try {
  const dependency = '<dependency><groupId>org.apache.logging.log4j</groupId><artifactId>log4j-core</artifactId><version>2.14.1</version>SCOPE</dependency>';
  for (const [name, content] of [
    ['compile', `<dependencies>${dependency.replace('SCOPE', '')}</dependencies>`],
    ['test', `<dependencies>${dependency.replace('SCOPE', '<scope>test</scope>')}</dependencies>`],
    ['plugin-dependency', `<build><plugins><plugin><groupId>org.apache.maven.plugins</groupId><artifactId>maven-compiler-plugin</artifactId><version>3.16.0</version><dependencies>${dependency.replace('SCOPE', '')}</dependencies></plugin></plugins></build>`],
  ]) {
    const path = join(directory, 'pom.xml');
    writeFileSync(path, `<project xmlns="http://maven.apache.org/POM/4.0.0"><modelVersion>4.0.0</modelVersion><groupId>example</groupId><artifactId>audit-gap</artifactId><version>1.0.0</version>${content}</project>`);
    const result = spawnSync(process.argv[2] || 'osv-scanner', ['scan', 'source', '-L', path, '--format', 'json'], { encoding: 'utf8', timeout: 60000 });
    if (result.error) throw result.error;
    const output = result.stdout.trim() ? JSON.parse(result.stdout) : {};
    console.log(JSON.stringify({ name, status: result.status, resultGroups: output.results?.length || 0 }));
    assert.equal(result.status, name === 'plugin-dependency' ? 128 : 1, result.stderr);
    assert.equal(Boolean(output.results?.length), name !== 'plugin-dependency');
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
