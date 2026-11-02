---
'my-package': patch
---

Fail the CI dependency freshness check only on pull requests and warn on push, schedule,
and manual runs (#14). Add Dependabot for Maven and GitHub Actions and a scheduled OSV
audit of Maven dependencies and build plugins (#15). Re-run jobs that never got a hosted
runner, at most twice, so a missing macOS runner no longer blocks the release (#16).
