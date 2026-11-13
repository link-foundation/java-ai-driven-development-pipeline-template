# Java AI-Driven Development Pipeline Template

A production-ready Java project template designed for AI-driven development workflows. Features comprehensive CI/CD automation, strict code quality standards, and modern best practices.

[![CI/CD Pipeline](https://github.com/link-foundation/java-ai-driven-development-pipeline-template/actions/workflows/release.yml/badge.svg)](https://github.com/link-foundation/java-ai-driven-development-pipeline-template/actions/workflows/release.yml)
[![Java 27+](https://img.shields.io/badge/Java-27%2B-blue)](https://adoptium.net/)
[![License: Unlicense](https://img.shields.io/badge/License-Unlicense-blue.svg)](https://unlicense.org)

## Features

- **Java 27 Support**: Tested with Java 27.0.1 on Linux, macOS and Windows
- **Comprehensive Testing**: JUnit 6 with parameterized tests and coverage reporting
- **Code Quality Tools**:
  - Spotless (Google Java Format) for consistent formatting
  - SpotBugs for static analysis
  - JaCoCo for code coverage
- **Pre-commit Hooks**: Automated quality checks before commits
- **CI/CD Pipeline**: GitHub Actions with multi-platform testing
- **Changesets Workflow**: JS-style changeset system to avoid merge conflicts
- **Release Automation**: Automatic and manual release workflows
- **Fast CI/CD Scripts**: Using Bun/Node.js (.mjs) for maximum performance

## Quick Start

### Using This Template

1. Click **"Use this template"** on GitHub
2. Clone your new repository
3. Customize the following:
   - `pom.xml`: Update `groupId`, `artifactId`, `name`, and `description`
   - Rename `src/main/java/com/linkfoundation/mypackage/` to match your package
   - Update package name in scripts: `scripts/*.mjs` (search for `PACKAGE_NAME`)
   - Update imports in tests and examples

### Development Setup

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO

# Verify prerequisites
java --version    # Should be 27.0.1+
./mvnw --version     # Should be 3.10.0+

# Build and test
./mvnw clean verify

# Install pre-commit hooks (optional)
pip install pre-commit==4.7.0
pre-commit install
```

## Project Structure

```
.
├── .changeset/                   # Changeset files (JS-style)
│   ├── config.json
│   └── README.md
├── .github/
│   ├── dependabot.yml            # Weekly Maven and GitHub Actions updates
│   └── workflows/
│       ├── release.yml           # CI/CD pipeline
│       ├── security.yml          # OSV audit of Maven dependencies and plugins
│       ├── workflows.yml         # Workflow policy and CI dependency freshness
│       └── rerun-unacquired.yml  # Re-runs jobs that never got a hosted runner
├── examples/
│   └── BasicUsage.java           # Usage examples
├── scripts/                      # CI/CD scripts (Node.js/Bun)
│   ├── audit-maven-plugins.mjs
│   ├── bump-version.mjs
│   ├── check-ci-dependencies.mjs
│   ├── check-file-size.mjs
│   ├── collect-changelog.mjs
│   ├── create-github-release.mjs
│   ├── create-manual-changeset.mjs
│   ├── merge-changesets.mjs
│   ├── rerun-unacquired.mjs
│   ├── validate-changeset.mjs
│   └── version-and-commit.mjs
├── src/
│   ├── main/java/                # Source code
│   └── test/java/                # Tests
├── .gitignore
├── .pre-commit-config.yaml
├── CHANGELOG.md
├── CONTRIBUTING.md
├── LICENSE
├── pom.xml
└── README.md
```

## Usage

### Library Functions

```java
import com.linkfoundation.mypackage.MyPackage;

// Basic arithmetic
long sum = MyPackage.add(2, 3);           // Returns 5
long product = MyPackage.multiply(4, 5);   // Returns 20

// Async delay
MyPackage.delay(1000).join();              // Waits for 1 second
```

### Running the Application

```bash
# Build and run
./mvnw package
java -jar target/my-package-0.2.0.jar
```

## Development

### Code Quality Commands

```bash
# Format code (applies fixes)
./mvnw spotless:apply

# Check formatting (CI mode)
./mvnw spotless:check

# Run static analysis
./mvnw spotbugs:check

# Run all tests
./mvnw test

# Run tests with coverage
./mvnw test jacoco:report
open target/site/jacoco/index.html

# Full verification
./mvnw verify

# Check file sizes
bun scripts/check-file-size.mjs
```

### Creating a Changeset

For every PR with code changes, create a changeset:

```bash
# Using the script (recommended)
bun scripts/create-manual-changeset.mjs --bump-type patch --description "Fix a bug"
bun scripts/create-manual-changeset.mjs --bump-type minor --description "Add new feature"
bun scripts/create-manual-changeset.mjs --bump-type major --description "Breaking change"
```

Or create manually in `.changeset/`:

```markdown
---
'my-package': patch
---

Description of the changes made.
```

## CI/CD Pipeline

### Automated Workflows

|     Trigger     |                     Actions                     |
|-----------------|-------------------------------------------------|
| Pull Request    | Lint, format check, tests, changeset validation |
| Push to main    | All checks + auto-release if changesets present |
| Manual dispatch | Changeset, instant, or changeset-pr mode        |
| Weekly schedule | Dependency audit and CI dependency freshness    |

### Dependency Updates and Audits

- **Dependabot** (`.github/dependabot.yml`) proposes weekly pull requests for
  `pom.xml` dependencies and plugins (`maven`) and for workflow actions
  (`github-actions`), skipping releases younger than seven days.
- **Security** (`security.yml`) audits the resolved `pom.xml` dependency tree
  with a checksum-verified [OSV-Scanner](https://github.com/google/osv-scanner)
  and the build plugins with `scripts/audit-maven-plugins.mjs`, on pull
  requests, pushes to `main`, and weekly. Any advisory, at any severity, fails.
  Pull requests also run GitHub's dependency review.
- **Workflow Policy** (`workflows.yml`) checks pinned actions and tools against
  their latest stable releases. A newer upstream release fails pull requests
  only; on pushes to `main`, schedules, and manual runs it is a warning with a
  step summary, because it is not caused by the commit being tested. Mismatched
  digests or checksums and lookup errors fail on every event.

### Hosted Runner Capacity

When GitHub cannot assign a hosted runner (most often macOS arm64), the job is
cancelled with "The job was not acquired by Runner of type hosted" before any
step runs, which skips the build and release gates. `rerun-unacquired.yml`
detects exactly those jobs (no runner, no steps, that annotation) and re-runs
the failed jobs up to twice; jobs that ran and failed are never re-run. After
the third attempt it fails with a "Hosted runner not acquired" error and the
`gh run rerun <run-id> --failed` command to run once capacity returns.

### Test Matrix

- **Operating Systems**: Linux, macOS, Windows
- **Java Version**: 27.0.1

### Release Process

The release process uses a **changeset-based workflow** similar to JavaScript's `@changesets/cli`:

1. **During Development**: Add changesets to PRs describing changes and bump type
2. **On Merge to Main**: Changesets accumulate until release
3. **Auto-Release**: When changesets are present, the release job:
   - Merges multiple changesets (highest bump type wins)
   - Bumps version automatically
   - Updates CHANGELOG.md
   - Creates GitHub release
   - Uploads the JARs, downloads them again, and verifies they are byte-identical

This template publishes JARs as **GitHub release assets only**. It does not
publish to Maven Central. A project that needs Maven Central distribution must
configure the [Central Publishing Maven Plugin](https://central.sonatype.org/publish/publish-portal-maven/),
credentials, signing, and required POM metadata. Its release workflow should
also wait until the artifact can be resolved from Central before announcing the
GitHub release.

### Release Modes (via workflow_dispatch)

|      Mode      |                  Description                  |
|----------------|-----------------------------------------------|
| `changeset`    | Release based on pending changesets (default) |
| `instant`      | Direct version bump without changesets        |
| `changeset-pr` | Create a PR with a new changeset              |

## Configuration

### pom.xml Customization

Key sections to customize:

```xml
<groupId>com.yourcompany</groupId>
<artifactId>your-package</artifactId>
<version>0.1.0</version>
<name>your-package</name>
<description>Your package description</description>
```

### Code Quality Settings

- **Spotless**: Google Java Format (2-space indent)
- **SpotBugs**: Maximum effort, low threshold
- **JaCoCo**: Branch coverage enabled
- **File size limit**: 1000 lines per file

## Scripts Reference

|            Script             |                Purpose                 |
|-------------------------------|----------------------------------------|
| `check-file-size.mjs`         | Validate files don't exceed 1000 lines |
| `bump-version.mjs`            | Bump semantic version in pom.xml       |
| `collect-changelog.mjs`       | Collect changesets into CHANGELOG.md   |
| `create-github-release.mjs`   | Create GitHub release                  |
| `create-manual-changeset.mjs` | Create a new changeset file            |
| `merge-changesets.mjs`        | Merge multiple changesets into one     |
| `validate-changeset.mjs`      | Validate changeset format              |
| `version-and-commit.mjs`      | Full release workflow                  |

## Design Decisions

### Why Maven?

- Standard Java build tool with excellent IDE support
- Rich plugin ecosystem
- Reproducible builds

### Why Spotless + Google Java Format?

- Eliminates formatting debates
- Consistent code style across the project
- Automated formatting

### Why Changesets Workflow?

- **No merge conflicts** on CHANGELOG.md
- **Automatic version determination** from changesets
- **Same pattern as JS template** for consistency across ecosystems
- Each PR documents its own changes with bump type

### Why Bun/Node.js for Scripts?

- Fast startup time for CI/CD
- Cross-platform compatibility
- Modern JavaScript features

## Related Templates

- [JS Template](https://github.com/link-foundation/js-ai-driven-development-pipeline-template)
- [Python Template](https://github.com/link-foundation/python-ai-driven-development-pipeline-template)
- [Rust Template](https://github.com/link-foundation/rust-ai-driven-development-pipeline-template)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

This project is released into the public domain under the [Unlicense](LICENSE).
