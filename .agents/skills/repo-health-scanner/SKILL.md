---
name: repo-health-scanner
description: Scan the repository for lint errors, security vulnerabilities, outdated dependencies, and project health issues using available tools.
---

# Repo Health Scanner

Comprehensive repository health analysis using available security and dependency tools

## Purpose

This skill provides standardized repository health scanning to identify security vulnerabilities, outdated dependencies, lint errors, and configuration issues. It uses the `bash` tool to run project-appropriate scanners based on detected project type and files.

## Quick Start

Use the included `scan.sh` script for a comprehensive scan:

```bash
# Scan current directory
$AGENT_SKILL_PATH/scan.sh

# Scan specific project
$AGENT_SKILL_PATH/scan.sh /path/to/project
```

Or run individual checks below.

## Core Principles

1. **Detect Project Type**: Identify project by `package.json`, `Cargo.toml`, `requirements.txt`, `go.mod`, etc.
2. **Use Available Tools**: Prefer tools already installed; recommend installation only when needed.
3. **Non-Destructive**: Scan only—never auto-fix without explicit user confirmation.
4. **Actionable Output**: Provide clear next steps for each issue found.

## Scanning Workflow

### Step 1: Detect Project Type

```bash
# Check for Node.js project
ls package.json 2>/dev/null && echo "NODE"

# Check for Python project  
ls requirements.txt pyproject.toml setup.py 2>/dev/null && echo "PYTHON"

# Check for Rust project
ls Cargo.toml 2>/dev/null && echo "RUST"

# Check for Go project
ls go.mod 2>/dev/null && echo "GO"
```

### Step 2: Run Project-Specific Scans

#### Node.js Projects

**Outdated Dependencies:**
```bash
# Use npm or yarn as appropriate
ls yarn.lock 2>/dev/null && yarn outdated --json 2>/dev/null || npm outdated --json 2>/dev/null
```

**Security Vulnerabilities:**
```bash
# Try npm audit first, fall back to npx
npm audit --json 2>/dev/null || npx audit-ci@latest --json 2>/dev/null
```

**Lint Errors (if config exists):**
```bash
# ESLint
ls .eslintrc* 2>/dev/null && npx eslint . --ext .js,.jsx,.ts,.tsx --format json 2>/dev/null

# Prettier check
ls .prettierrc* 2>/dev/null && npx prettier --check "**/*.{js,jsx,ts,tsx,json,md}" 2>&1
```

**Unused Dependencies:**
```bash
# Try depcheck if available
npx depcheck@latest --json 2>/dev/null || echo "Install depcheck for unused deps scan"
```

#### Python Projects

**Outdated Dependencies:**
```bash
# pip list --outdated
ls requirements.txt 2>/dev/null && pip show pip 1>/dev/null 2>&1 && pip list --outdated --format json 2>/dev/null
```

**Security Vulnerabilities:**
```bash
# Safety check for requirements.txt
pip show safety 1>/dev/null 2>&1 && safety check --json 2>/dev/null || echo "Install 'safety' for vuln scanning: pip install safety"

# Or use pip-audit
pip show pip-audit 1>/dev/null 2>&1 && pip-audit --format=json 2>/dev/null || echo "Install 'pip-audit' for vuln scanning: pip install pip-audit"
```

**Lint/Format Issues:**
```bash
# Ruff (modern, fast)
ls ruff.toml pyproject.toml 2>/dev/null && ruff check --output-format json . 2>/dev/null

# Pylint (traditional)
ls .pylintrc pyproject.toml setup.cfg 2>/dev/null && pylint --output-format=json . 2>/dev/null | head -100

# Black format check
ls pyproject.toml 2>/dev/null && grep -q "black" pyproject.toml && black --check --diff . 2>&1 | head -50
```

#### Rust Projects

**Outdated Dependencies:**
```bash
# cargo-outdated
which cargo-outdated 1>/dev/null 2>&1 && cargo outdated --format json 2>/dev/null || echo "Install cargo-outdated: cargo install cargo-outdated"
```

**Security Vulnerabilities:**
```bash
# cargo-audit
which cargo-audit 1>/dev/null 2>&1 && cargo audit --json 2>/dev/null || echo "Install cargo-audit: cargo install cargo-audit"
```

**Lint/Clippy:**
```bash
# Built-in with Rust
rustup component list | grep -q clippy && cargo clippy --all-targets --all-features -- -D warnings 2>&1 | head -50
```

#### Go Projects

**Outdated Dependencies:**
```bash
# Go mod outdated
go list -u -m -json all 2>/dev/null | grep -A1 "Update" | head -50
```

**Vulnerabilities:**
```bash
# govulncheck
which govulncheck 1>/dev/null 2>&1 && govulncheck -json ./... 2>/dev/null || echo "Install govulncheck: go install golang.org/x/vuln/cmd/govulncheck@latest"

# Or gosec
which gosec 1>/dev/null 2>&1 && gosec -fmt json ./... 2>/dev/null || echo "Install gosec: go install github.com/securego/gosec/v2/cmd/gosec@latest"
```

**Lint:**
```bash
# Standard go tools
go vet ./... 2>&1 | head -30
gofmt -l . 2>&1 | head -30
```

### Step 3: Universal Cross-Project Checks

**Check for Common Security Issues:**
```bash
# Search for common patterns
echo "=== Checking for potential secrets/hardcoded values ==="
grep -r -n "api_key\|apikey\|password\|secret\|token\|private_key" --include="*.py" --include="*.js" --include="*.ts" --include="*.go" --include="*.rs" . 2>/dev/null | grep -v "node_modules" | grep -v "vendor" | head -20

echo "=== Checking for TODO/FIXME comments ==="
grep -r -n "TODO\|FIXME\|XXX\|HACK" --include="*.py" --include="*.js" --include="*.ts" --include="*.go" --include="*.rs" . 2>/dev/null | grep -v node_modules | grep -v vendor | head -20
```

**Check File Sizes (potential bloat):**
```bash
echo "=== Largest files (>1MB) ==="
find . -type f -size +1M 2>/dev/null | grep -v node_modules | grep -v ".git" | head -20
```

**Check for Binary Files in Git:**
```bash
echo "=== Binary files tracked in git ==="
git grep -I --name-only -e . 2>/dev/null | head -30 || echo "Not a git repo or no files found"
```

## Report Template

After scanning, present findings in this format:

```
## Repository Health Report: <project-name>

**Project Type:** <detected-type>  
**Scan Date:** <timestamp>

---

### Dependencies Status
- **Outdated:** <count> packages (run `npm update` or equivalent)
- **Critical:** <list of critical outdated packages>

### Security
- **Vulnerabilities:** <count> (<critical> critical, <high> high, <moderate> moderate)
- **Recommendation:** <action>

### Code Quality
- **Lint Errors:** <count>
- **Format Issues:** <count>
- **TODO/FIXME:** <count> items (see output above)

### Maintenance
- **Unused Dependencies:** <count> (potential cleanup)
- **Large Files:** <count> files >1MB
- **Binary Files in Git:** <count>

### Immediate Actions Recommended
1. [Priority action 1]
2. [Priority action 2]
3. [Priority action 3]

---
**Install Missing Tools:**
[Commands to install recommended scanners if user wants deeper analysis]
```

## Example Session

**User:** Scan this repo for issues

**Agent:**
> Detecting project type...
> - Found package.json → Node.js project
> - Found requirements.txt → Python project

> Running scans...

**[Runs appropriate commands for detected project types]**

> ## Repository Health Report
> 
> **Project Type:** Node.js + Python  
> **Scan Date:** 2025-01-XX
>
> ### Dependencies Status
> - **npm:** 2 outdated (lodash, express)
> - **pip:** 1 outdated (requests)
>
> ### Security
> - **npm audit:** 0 vulnerabilities ✓
> - **pip-audit:** not installed (install for Python vuln scanning)
>
> ### Code Quality
> - **ESLint:** 12 errors, 3 warnings
> - **Prettier:** 5 files need formatting
>
> ### Immediate Actions
> 1. Run `npm update lodash express` to update outdated deps
> 2. Run `npx eslint . --fix` to auto-fix lint errors
> 3. Run `npx prettier --write .` to format files

## Quality Checklist

Before presenting scan results:

- [ ] Project type correctly detected
- [ ] Ran appropriate scanners for project type
- [ ] Presented actionable next steps
- [ ] Separated urgent (security) from optional (formatting) issues
- [ ] Provided install commands for missing tools
- [ ] Respected security—no exposed secrets in output
