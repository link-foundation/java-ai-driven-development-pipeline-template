"""Resolve current Maven artifact metadata with bounded network concurrency."""
import concurrent.futures
import json
import re
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path

root = Path('dev/log/issues/24/pulls/25')
def parse_report(report):
    versions = {}
    for line in report.splitlines():
        fields = line.strip().split()
        if not fields or ':' not in fields[0]:
            continue
        parts = fields[0].split(':')
        version = parts[-2] if parts[-1] in ('compile', 'provided', 'runtime', 'test', 'system') else parts[-1]
        versions.setdefault(':'.join(parts[:2]), set()).add(version)
    return versions

before = parse_report((root / 'sources/resolved-artifacts-original-main.txt').read_text())
current = parse_report((root / 'sources/resolved-artifacts-final.txt').read_text())
versions = {name: before.get(name, set()) for name in before.keys() | current.keys()}

def resolve(item):
    name, before = item
    group, artifact = name.split(':')
    url = f'https://repo.maven.apache.org/maven2/{group.replace(".", "/")}/{artifact}/maven-metadata.xml'
    result = subprocess.run(['curl', '-fsSL', '--retry', '2', url], capture_output=True)
    if result.returncode:
        return dict(name=name, before=sorted(before), latest=None, error=result.stderr.decode(), source=url)
    data = result.stdout
    entries = [v.text for v in ET.fromstring(data).findall('versioning/versions/version')]
    stable = [v for v in entries if not re.search(r'(alpha|beta|(?<![a-z])rc|snapshot|milestone|preview|(?:^|[.-])m\d)', v, re.I)]
    # Maven metadata is publication ordered; compare numeric version components,
    # retaining stable date/build suffixes such as Jetty's .v20261001.
    def key(v):
        return tuple(int(x) for x in re.findall(r'\d+', v))
    stable = [v for v in stable if not re.match(r'^(19|20)\d{6}(\.|$)', v)] or stable
    latest = max(stable, key=key) if stable else entries[-1]
    row_current = sorted(current.get(name, set()))
    return dict(name=name, before=sorted(before), current=row_current, latest=latest, stable=bool(stable), source=url, metadata=data.decode('utf-8'))

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    rows = sorted(pool.map(resolve, versions.items()), key=lambda row: row['name'])
metadata = {row['name']: {'source': row['source'], 'xml': row.pop('metadata')} for row in rows if 'metadata' in row}
# Small indexed batches keep each snapshot below the repository's 500 KiB limit
# and the complete PR below GitHub's 300-file diff limit.
names = sorted(metadata)
for offset in range(0, len(names), 70):
    batch = {name: metadata[name] for name in names[offset:offset + 70]}
    (root / f'sources/transitive-registry-metadata-{offset // 70 + 1}.json').write_text(json.dumps(batch, indent=2) + '\n')
(root / 'sources/transitive-inventory.json').write_text(json.dumps(rows, indent=2) + '\n')
lines = ['# Resolved Maven artifact inventory', '', 'Registry queries: 2026-11-13. Before is the untouched main commit `600f3c7`; current is the resolved final project/test tree and declared build plugins, with release signing enabled. Versions inside plugin realms are audited separately. Original and final Maven resolution reports and raw metadata are in `sources/`.', '', 'The old super-POM site tool is not declared or invoked anywhere in this repository and is outside the active jar build. It is deliberately not introduced as a new dependency: its unreleased upstream replacement uses the JDK HTTP server (apache/maven-site-plugin#1298). Old artifacts absent from the active final tree are marked removed/replaced, rather than being reported as updated.', '', '| Artifact | Before | Current | Latest stable (or upstream prerelease where no GA exists) | Decision |', '|---|---|---|---|---|']
for row in rows:
    actual = row.get('current', [])
    if not actual:
        decision = 'Removed/replaced from active build; no remaining pin'
    elif actual == [row['latest']]:
        decision = 'Current' if row['before'] == actual else 'Updated'
    elif row['name'] == 'org.codehaus.plexus:plexus-build-api':
        decision = 'Retain 1.2.0: 1.3.0 has duplicate Guice scopes; verified failure and upstream [#127](https://github.com/codehaus-plexus/plexus-build-api/issues/127)'
    elif row['name'] in ('org.apache.maven.doxia:doxia-sink-api', 'org.apache.maven.reporting:maven-reporting-api'):
        decision = 'Retain legacy API only in JaCoCo: old Sink ABI required; other plugins use latest; upstream [#2347](https://github.com/jacoco/jacoco/issues/2347)'
    else:
        decision = 'REVIEW REQUIRED'
    if not row.get('stable', True):
        decision += '; no GA artifact exists; required by stable Plexus XML 4.2.0'
    row['decision'] = decision
    lines.append(f"| [{row['name']}]({row['source']}) | {', '.join(row['before']) or 'absent'} | {', '.join(actual) or 'absent'} | {row['latest']} | {decision} |")
(root / 'sources/transitive-inventory.json').write_text(json.dumps(rows, indent=2) + '\n')
(root / 'TRANSITIVE-DEPENDENCIES.md').write_text('\n'.join(lines) + '\n')
for row in rows:
    if row.get('current') and row['current'] != [row['latest']]:
        print(row['name'], ','.join(row['current']), '->', row['latest'], row['decision'])
print('Total:', len(rows))
