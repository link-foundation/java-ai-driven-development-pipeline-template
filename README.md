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
- **Changelog Management**: Fragment-based system to avoid merge conflicts
- **Release Automation**: Automatic and manual release workflows
- **Fast CI/CD Scripts**: Using Bun/Node.js (.mjs) for maximum performance

## Quick Start

### Using This Template

1. Click **"Use this template"** on GitHub
2. Clone your new repository
3. Customize the following:
   - `pom.xml`: Update `groupId`, `artifactId`, `name`, and `description`
   - Rename `src/main/java/com/linkfoundation/mypackage/` to match your package
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
├── .github/
│   └── workflows/
│       └── release.yml          # CI/CD pipeline
├── changelog.d/                  # Changelog fragments
│   └── README.md
├── examples/
│   └── BasicUsage.java          # Usage examples
├── scripts/                      # CI/CD scripts (Node.js/Bun)
│   ├── bump-version.mjs
│   ├── check-file-size.mjs
│   ├── collect-changelog.mjs
│   ├── create-github-release.mjs
│   ├── create-manual-changeset.mjs
│   ├── validate-changeset.mjs
│   └── version-and-commit.mjs
├── src/
│   ├── main/java/               # Source code
│   └── test/java/               # Tests
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

### Creating a Changelog Fragment

For every PR with code changes, create a changelog fragment:

```bash
# Using the script
bun scripts/create-manual-changeset.mjs --description "my-feature"

# Or manually
touch changelog.d/$(date +%Y%m%d_%H%M%S)_my_feature.md
```

Then edit the file to describe your changes.

## CI/CD Pipeline

### Automated Workflows

|     Trigger     |                     Actions                     |
|-----------------|-------------------------------------------------|
| Pull Request    | Lint, format check, tests, changelog validation |
| Push to main    | All checks + auto-release if version changed    |
| Manual dispatch | Version bump + release                          |

### Test Matrix

- **Operating Systems**: Linux, macOS, Windows
- **Java Versions**: 17, 21

### Release Process

**Automatic Release**:
1. Update version in `pom.xml` and `MyPackage.java`
2. Merge to `main`
3. CI creates GitHub release automatically

**Manual Release**:
1. Go to Actions → CI/CD Pipeline
2. Click "Run workflow"
3. Select bump type (patch/minor/major)

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
| `collect-changelog.mjs`       | Merge changelog fragments              |
| `create-github-release.mjs`   | Create GitHub release                  |
| `create-manual-changeset.mjs` | Create changelog fragment              |
| `validate-changeset.mjs`      | Validate changelog fragments           |
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

### Why Fragment-Based Changelog?

- No merge conflicts on `CHANGELOG.md`
- Each PR documents its own changes
- Automated collection during release

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
