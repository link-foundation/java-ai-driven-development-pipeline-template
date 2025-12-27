---
'my-package': minor
---

Add JS-style changeset workflow for managing version bumps and changelogs.

This implementation:
- Uses `.changeset/` folder structure similar to JavaScript's `@changesets/cli`
- Changeset files include package name and bump type in frontmatter
- Automatically determines version bump from changesets (highest type wins)
- Merges multiple changesets during release
- Supports three release modes: changeset, instant, and changeset-pr
- Eliminates merge conflicts on CHANGELOG.md
