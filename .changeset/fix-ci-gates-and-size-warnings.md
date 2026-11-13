---
'my-package': patch
---

Report outdated CI dependencies as warnings on every event so upstream releases do
not block unrelated PRs during Dependabot's cooldown. Accept full action commit SHA
pins with exact version comments and verify that each tag resolves to the pinned
commit. Retry all OSV-Scanner download errors with a delay and connection timeout.
Check JavaScript files as well as Java files and warn from 900 lines (#22).
