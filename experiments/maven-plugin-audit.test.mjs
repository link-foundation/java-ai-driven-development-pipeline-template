#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { auditArtifacts, collectBuildArtifacts, collectResolvedArtifacts } from '../scripts/audit-maven-plugins.mjs';

const pom = `<project>
  <properties>
    <compiler.version>3.12.1</compiler.version>
    <formatter.version>1.19.2</formatter.version>
  </properties>
  <build>
    <plugins>
      <!-- <plugin><artifactId>commented-out</artifactId><version>0.0.1</version></plugin> -->
      <plugin>
        <artifactId>maven-compiler-plugin</artifactId>
        <version>\${compiler.version}</version>
        <configuration><release>17</release></configuration>
      </plugin>
      <plugin>
        <groupId>com.diffplug.spotless</groupId>
        <artifactId>spotless-maven-plugin</artifactId>
        <version>2.43.0</version>
        <configuration>
          <java><googleJavaFormat><version>\${formatter.version}</version></googleJavaFormat></java>
        </configuration>
        <dependencies>
          <dependency>
            <groupId>org.apache.maven.shared</groupId>
            <artifactId>maven-shared-utils</artifactId>
            <version>3.0.0</version>
          </dependency>
        </dependencies>
      </plugin>
    </plugins>
  </build>
</project>`;

test('collects plugins, plugin dependencies, and the Spotless formatter with resolved properties', () => {
  assert.deepEqual(collectBuildArtifacts(pom), [
    { name: 'org.apache.maven.plugins:maven-compiler-plugin', version: '3.12.1' },
    { name: 'com.diffplug.spotless:spotless-maven-plugin', version: '2.43.0' },
    { name: 'org.apache.maven.shared:maven-shared-utils', version: '3.0.0' },
    { name: 'com.google.googlejavaformat:google-java-format', version: '1.19.2' },
  ]);
});

test('rejects plugins without a version, undefined properties, and version ranges', () => {
  assert.throws(() => collectBuildArtifacts('<plugin><artifactId>a</artifactId></plugin>'), /explicit version/);
  assert.throws(() => collectBuildArtifacts('<plugin><artifactId>a</artifactId><version>${missing}</version></plugin>'), /not defined/);
  assert.throws(() => collectBuildArtifacts('<plugin><artifactId>a</artifactId><version>[1.0,)</version></plugin>'), /exact version/);
});

test('the template pom.xml keeps every build plugin version explicit and auditable', () => {
  const artifacts = collectBuildArtifacts(readFileSync(resolve(import.meta.dirname, '..', 'pom.xml'), 'utf8'));
  const names = artifacts.map(artifact => artifact.name);
  for (const plugin of ['maven-enforcer-plugin', 'spotbugs-maven-plugin', 'jacoco-maven-plugin', 'maven-gpg-plugin', 'google-java-format']) {
    assert.ok(names.some(name => name.endsWith(`:${plugin}`)), `${plugin} is audited`);
  }
});

test('reports only artifacts with advisories and sends Maven OSV queries', async () => {
  let sent;
  const findings = await auditArtifacts(collectBuildArtifacts(pom), async queries => {
    sent = queries;
    return queries.map(query => (query.package.name.endsWith(':maven-shared-utils') ? { vulns: [{ id: 'GHSA-rhgr-952r-6p8q' }] } : {}));
  });
  assert.equal(sent.length, 4);
  assert.deepEqual(sent[0], { package: { ecosystem: 'Maven', name: 'org.apache.maven.plugins:maven-compiler-plugin' }, version: '3.12.1' });
  assert.deepEqual(findings, [{ name: 'org.apache.maven.shared:maven-shared-utils', version: '3.0.0', ids: ['GHSA-rhgr-952r-6p8q'] }]);
});

test('OSV lookup failures propagate instead of reporting no advisories', async () => {
  await assert.rejects(auditArtifacts(collectBuildArtifacts(pom), async () => { throw new Error('OSV: HTTP 503'); }), /503/);
});

test('resolved Maven reports include test dependencies and plugin transitives without duplicates', () => {
  const artifacts = collectResolvedArtifacts(`
The following files have been resolved:
   org.junit.jupiter:junit-jupiter:jar:6.1.3:test -- module org.junit.jupiter
The following plugins have been resolved:
   org.apache.maven.plugins:maven-compiler-plugin:jar:3.16.0
      org.example:transitive:jar:1.2.3
      org.example:transitive:jar:1.2.3
      org.example:classified:jar:linux:2.0.0:runtime
`);
  assert.deepEqual(artifacts, [
    { name: 'org.junit.jupiter:junit-jupiter', version: '6.1.3' },
    { name: 'org.apache.maven.plugins:maven-compiler-plugin', version: '3.16.0' },
    { name: 'org.example:transitive', version: '1.2.3' },
    { name: 'org.example:classified', version: '2.0.0' },
  ]);
  assert.throws(() => collectResolvedArtifacts('no resolved artifacts'), /no artifacts/);
  assert.throws(() => collectResolvedArtifacts('org.example:bad:jar:[1,2)'), /Invalid/);
});
