"""Collect authoritative stable dependency versions for issue 24; no builds."""
import json
import re
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path

OUT = Path('dev/log/issues/24/pulls/25/sources')

def get(url):
    return subprocess.check_output(['curl', '-fsSL', url])

def gh(path):
    return json.loads(subprocess.check_output(['gh', 'api', path]))

pom = ET.fromstring(subprocess.check_output(['git', 'show', '600f3c7:pom.xml']))
ns = {'m': 'http://maven.apache.org/POM/4.0.0'}
props = {e.tag.split('}')[-1]: e.text for e in pom.find('m:properties', ns)}
coordinates = {}
for kind in ('dependency', 'plugin'):
    for el in pom.findall(f'.//m:{kind}', ns):
        group = el.findtext('m:groupId', 'org.apache.maven.plugins', ns)
        artifact = el.findtext('m:artifactId', namespaces=ns)
        version = el.findtext('m:version', namespaces=ns)
        if version:
            coordinates[(group, artifact)] = props.get(version[2:-1], version) if version.startswith('${') else version
coordinates[('com.google.googlejavaformat', 'google-java-format')] = props['google-java-format.version']
coordinates[('com.puppycrawl.tools', 'checkstyle')] = props['checkstyle.version']
for artifact in ['maven-clean-plugin', 'maven-resources-plugin', 'maven-install-plugin', 'maven-deploy-plugin', 'maven-site-plugin']:
    coordinates[('org.apache.maven.plugins', artifact)] = '(implicit Maven default)'
coordinates[('org.apache.maven', 'apache-maven')] = '[3.8.0,)'
coordinates[('org.apache.maven.plugins', 'maven-wrapper-plugin')] = '(absent)'
coordinates[('org.apache.maven.plugins', 'maven-dependency-plugin')] = '(implicit/unpinned security resolver)'
coordinates[('org.codehaus.mojo', 'versions-maven-plugin')] = '(not pinned; maintenance tool)'
rows = []
for (group, artifact), before in coordinates.items():
    url = f'https://repo.maven.apache.org/maven2/{group.replace(".", "/")}/{artifact}/maven-metadata.xml'
    data = get(url)
    metadata = ET.fromstring(data)
    versions = [v.text for v in metadata.findall('versioning/versions/version') if re.fullmatch(r'\d+(?:\.\d+)+', v.text)]
    latest = max(versions, key=lambda v: tuple(map(int, v.split('.'))))
    (OUT / f'maven-{artifact}.xml').write_bytes(data)
    rows.append({'ecosystem':'Maven','name':f'{group}:{artifact}','before':before,'latest':latest,'source':url})
repos = set(re.findall(r'uses:\s*([\w.-]+/[\w.-]+)@', ''.join(p.read_text() for p in Path('.github/workflows').glob('*.yml'))))
repos.update(['oven-sh/bun', 'rhysd/actionlint', 'google/osv-scanner', 'pre-commit/pre-commit-hooks', 'pre-commit/pre-commit', 'actions/setup-node'])
for repo in sorted(repos):
    release = gh(f'repos/{repo}/releases/latest')
    (OUT / f'github-{repo.replace("/", "-")}.json').write_text(json.dumps(release, indent=2)+'\n')
    rows.append({'ecosystem':'GitHub/tool','name':repo,'latest':release['tag_name'],'source':release['html_url']})
for name, url in [('node','https://nodejs.org/dist/index.json'), ('adoptium','https://api.adoptium.net/v3/info/available_releases'), ('pre-commit-pypi','https://pypi.org/pypi/pre-commit/json')]:
    data = get(url)
    (OUT / f'{name}.json').write_bytes(data)
(OUT / 'registry-inventory.json').write_text(json.dumps(rows, indent=2)+'\n')
for row in rows:
    print(row['name'], row.get('before', ''), '->', row['latest'])
