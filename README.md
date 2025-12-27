# Java AI-Driven Development Pipeline Template

A production-ready Java project template designed for AI-driven development workflows. Features comprehensive CI/CD automation, strict code quality standards, and modern best practices.

[![CI/CD Pipeline](https://github.com/link-foundation/java-ai-driven-development-pipeline-template/actions/workflows/release.yml/badge.svg)](https://github.com/link-foundation/java-ai-driven-development-pipeline-template/actions/workflows/release.yml)
[![Java 17+](https://img.shields.io/badge/Java-17%2B-blue)](https://adoptium.net/)
[![License: Unlicense](https://img.shields.io/badge/License-Unlicense-blue.svg)](https://unlicense.org)

## Features

- **Multi-version Java Support**: Tested with Java 17 and 21
- **Comprehensive Testing**: JUnit 5 with parameterized tests and coverage reporting
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
java --version    # Should be 17+
mvn --version     # Should be 3.8+

# Build and test
mvn clean verify

# Install pre-commit hooks (optional)
pip install pre-commit
pre-commit install
```

## Project Structure

```
.
├── .changeset/                   # Changeset files (JS-style)
│   ├── config.json
│   └── README.md
├── .github/
│   └── workflows/
│       └── release.yml           # CI/CD pipeline
├── examples/
│   └── BasicUsage.java           # Usage examples
├── scripts/                      # CI/CD scripts (Node.js/Bun)
│   ├── bump-version.mjs
│   ├── check-file-size.mjs
│   ├── collect-changelog.mjs
│   ├── create-github-release.mjs
│   ├── create-manual-changeset.mjs
│   ├── merge-changesets.mjs
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
mvn package
java -jar target/my-package-0.1.0.jar

# Or run directly
mvn exec:java -Dexec.mainClass="com.linkfoundation.mypackage.Main"
```

## Development

### Code Quality Commands

```bash
# Format code (applies fixes)
mvn spotless:apply

# Check formatting (CI mode)
mvn spotless:check

# Run static analysis
mvn spotbugs:check

# Run all tests
mvn test

# Run tests with coverage
mvn test jacoco:report
open target/site/jacoco/index.html

# Full verification
mvn verify

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

### Test Matrix

- **Operating Systems**: Linux, macOS, Windows
- **Java Versions**: 17, 21

### Release Process

The release process uses a **changeset-based workflow** similar to JavaScript's `@changesets/cli`:

1. **During Development**: Add changesets to PRs describing changes and bump type
2. **On Merge to Main**: Changesets accumulate until release
3. **Auto-Release**: When changesets are present, the release job:
   - Merges multiple changesets (highest bump type wins)
   - Bumps version automatically
   - Updates CHANGELOG.md
   - Creates GitHub release

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
