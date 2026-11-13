# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- changelog-insert-here -->

## [0.2.0] - 2025-12-27

Add JS-style changeset workflow for managing version bumps and changelogs.

This implementation:
- Uses `.changeset/` folder structure similar to JavaScript's `@changesets/cli`
- Changeset files include package name and bump type in frontmatter
- Automatically determines version bump from changesets (highest type wins)
- Merges multiple changesets during release
- Supports three release modes: changeset, instant, and changeset-pr
- Eliminates merge conflicts on CHANGELOG.md

## [0.1.0] - 2024-12-27

### Added

- Initial release of the Java AI-driven development pipeline template
- Core library with `add()`, `multiply()`, and `delay()` functions
- Comprehensive test suite with JUnit 5
- Maven build configuration with:
  - Spotless for code formatting (Google Java Style)
  - SpotBugs for static analysis
  - JaCoCo for code coverage
- GitHub Actions CI/CD pipeline with:
  - Multi-platform testing (Linux, macOS, Windows)
  - Multi-version Java testing (17, 21)
  - Automatic release on version change
  - Manual release workflow dispatch
- Pre-commit hooks configuration
- Changelog fragment system for conflict-free documentation
- Scripts (using Bun/Node.js for fast CI/CD):
  - `check-file-size.mjs` - File size validation
  - `bump-version.mjs` - Semantic version bumping
  - `collect-changelog.mjs` - Changelog fragment collection
  - `create-github-release.mjs` - GitHub release creation
  - `version-and-commit.mjs` - Release automation
  - `validate-changeset.mjs` - Changelog validation
  - `create-manual-changeset.mjs` - Manual fragment creation
- Example code demonstrating library usage
- Comprehensive documentation (README, CONTRIBUTING)
