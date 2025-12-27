# Changelog Fragments

This directory contains changelog fragment files that document changes for upcoming releases.

## Why Fragments?

Using individual fragment files instead of editing `CHANGELOG.md` directly:
- **Avoids merge conflicts** when multiple PRs are open
- **Associates changes with PRs** for better traceability
- **Enforces documentation** of all changes

## Creating a Fragment

### Using the Script

```bash
# Create a new fragment with auto-generated filename
bun scripts/create-manual-changeset.mjs --description "my-feature"
```

### Manually

Create a file with the naming convention:

```
YYYYMMDD_HHMMSS_description.md
```

Example: `20241215_143000_add_new_feature.md`

## Fragment Format

Use [Keep a Changelog](https://keepachangelog.com/) categories:

```markdown
### Added
- New feature or capability

### Changed
- Changes to existing functionality

### Deprecated
- Features that will be removed in future versions

### Removed
- Features that have been removed

### Fixed
- Bug fixes

### Security
- Security-related changes
```

**Important**: Only include categories that apply to your changes. Remove unused sections.

## Example Fragment

```markdown
### Added
- Add async delay function with CompletableFuture support

### Fixed
- Fix integer overflow in multiply function for large numbers
```

## What Happens During Release

1. The release workflow runs `scripts/collect-changelog.mjs`
2. All `.md` files in this directory (except README.md) are combined
3. A new version entry is added to `CHANGELOG.md`
4. Fragment files are deleted

## Tips

- Be concise but descriptive
- Use present tense ("Add feature" not "Added feature")
- Reference issue numbers when applicable: "Fix login bug (#123)"
- One fragment per PR is typical, but multiple are allowed

