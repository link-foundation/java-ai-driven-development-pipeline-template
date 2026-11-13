"""Historical first-draft experiment, before compatibility refinements.

The final POM includes subsequent fixes described in the investigation logs.
Do not reapply this draft to an already migrated POM.
"""
import json
import re
from pathlib import Path

root = Path('dev/log/issues/24/pulls/25')
if '<build.plexus-utils.version>' in Path('pom.xml').read_text():
    raise SystemExit('Draft already applied; use the checked-in POM for the final migration.')
rows = {r['name']: r for r in json.loads((root / 'sources/transitive-inventory.json').read_text())}
# Replaced by current archiver; do not preserve obsolete, unused compressors.
removed = {'io.airlift:aircompressor', 'org.iq80.snappy:snappy'}
# Initial conservative choice, subsequently replaced by tested XML 4.2.0.
rows['org.codehaus.plexus:plexus-xml']['latest'] = '3.1.0'
# Legacy date-shaped artifact predates the numbered releases.
rows['commons-collections:commons-collections']['latest'] = '3.2.2'
report = (root / 'sources/resolved-artifacts-before-overrides.txt').read_text()
by_plugin = {}
plugin = None
for line in report.splitlines():
    if re.match(r'^   \S+:\S+:', line):
        plugin = ':'.join(line.strip().split(':')[:2])
        by_plugin[plugin] = set()
    elif line.startswith('      ') and ':' in line:
        name = ':'.join(line.strip().split(':')[:2])
        if name != plugin and name not in removed:
            row = rows[name]
            if row['latest'] and row['before'] != [row['latest']]:
                by_plugin[plugin].add(name)
text = Path('pom.xml').read_text()
# site is not a repository feature or a jar lifecycle plugin. Avoid introducing
# an unused server with unpatchable Jetty 9 CVEs solely for this update.
text = re.sub(r'        <maven-site.version>.*?</maven-site.version>\n', '', text)
text = re.sub(r'            <plugin>\s*<groupId>org.apache.maven.plugins</groupId>\s*<artifactId>maven-site-plugin</artifactId>.*?</plugin>\n', '', text, flags=re.S)
by_plugin.pop('org.apache.maven.plugins:maven-site-plugin', None)
used = sorted(set().union(*by_plugin.values()))
props = '\n        <!-- Audited transitive build dependencies; upstream plugins lag these releases. -->\n'
for name in used:
    artifact = name.split(':')[1]
    props += f'        <build.{artifact}.version>{rows[name]["latest"]}</build.{artifact}.version>\n'
text = text.replace('    </properties>', props+'    </properties>')

def update(match):
    block = match[0]
    group = re.search(r'<groupId>(.*?)</groupId>', block)[1]
    artifact = re.search(r'<artifactId>(.*?)</artifactId>', block)[1]
    deps = by_plugin.get(f'{group}:{artifact}', ())
    if not deps:
        return block
    indent = re.search(r'\n( +)<groupId>', block)[1][:-4]
    added = f'\n{indent}    <dependencies>\n'
    for name in sorted(deps):
        dep_group, dep_artifact = name.split(':')
        added += f'{indent}        <dependency>\n{indent}            <groupId>{dep_group}</groupId>\n{indent}            <artifactId>{dep_artifact}</artifactId>\n{indent}            <version>${{build.{dep_artifact}.version}}</version>\n{indent}        </dependency>\n'
    added += f'{indent}    </dependencies>'
    return block.replace(f'\n{indent}</plugin>', added+f'\n{indent}</plugin>')
text = re.sub(r'<plugin>.*?</plugin>', update, text, flags=re.S)
# JUnit 6.1.3 still declares JSpecify 1.0.0; keep the resolved test tree current.
text = text.replace('    <dependencies>', '    <dependencyManagement>\n        <dependencies>\n            <dependency>\n                <groupId>org.jspecify</groupId>\n                <artifactId>jspecify</artifactId>\n                <version>${build.jspecify.version}</version>\n            </dependency>\n        </dependencies>\n    </dependencyManagement>\n\n    <dependencies>', 1)
Path('pom.xml').write_text(text)
print('Updated', len(used), 'shared version properties across', len(by_plugin), 'plugins')
