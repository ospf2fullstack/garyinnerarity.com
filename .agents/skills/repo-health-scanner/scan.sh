#!/bin/bash
#
# Repo Health Scanner - Unified scanning script
# Usage: ./scan.sh [project-path]

set -e

PROJECT_PATH="${1:-.}"
cd "$PROJECT_PATH"

# Colors for output (disable if not tty)
if [ -t 1 ]; then
    RED='\033[0;31m'
    YELLOW='\033[1;33m'
    GREEN='\033[0;32m'
    BLUE='\033[0;34m'
    NC='\033[0m' # No Color
else
    RED='' YELLOW='' GREEN='' BLUE='' NC=''
fi

# Output helpers
info() { echo -e "${BLUE}ℹ${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }

# JSON output buffer
OUTPUT_FILE="/tmp/repo-health-$$.json"
echo "{" > "$OUTPUT_FILE"

FIRST_SECTION=true

start_section() {
    if [ "$FIRST_SECTION" = true ]; then
        FIRST_SECTION=false
    else
        echo "," >> "$OUTPUT_FILE"
    fi
    echo "  \"$1\": {" >> "$OUTPUT_FILE"
}

end_section() {
    echo "  }" >> "$OUTPUT_FILE"
}

add_field() {
    local key="$1"
    local value="$2"
    local comma="$3"
    if [ -n "$comma" ]; then
        echo "    \"$key\": $value" >> "$OUTPUT_FILE"
    else
        echo "    \"$key\": $value," >> "$OUTPUT_FILE"
    fi
}

echo "========================================"
echo "       Repository Health Scanner"
echo "========================================"
echo ""

# Detect project types
info "Detecting project types..."
PROJECT_TYPES=""
[ -f "package.json" ] && PROJECT_TYPES="$PROJECT_TYPES node"
[ -f "requirements.txt" ] && PROJECT_TYPES="$PROJECT_TYPES python"
[ -f "pyproject.toml" ] && PROJECT_TYPES="$PROJECT_TYPES python"
[ -f "setup.py" ] && PROJECT_TYPES="$PROJECT_TYPES python"
[ -f "Cargo.toml" ] && PROJECT_TYPES="$PROJECT_TYPES rust"
[ -f "go.mod" ] && PROJECT_TYPES="$PROJECT_TYPES go"

if [ -z "$PROJECT_TYPES" ]; then
    warn "No recognized project files found (package.json, requirements.txt, Cargo.toml, go.mod)"
    PROJECT_TYPES="unknown"
else
    success "Detected: $PROJECT_TYPES"
fi
echo ""

# Start JSON output
echo "  \"project_types\": [$(echo "$PROJECT_TYPES" | sed 's/ /", "/g; s/^/"/; s/$/"/')]," >> "$OUTPUT_FILE"

# ============================================
# SECURITY SCAN
# ============================================
start_section "security"

info "Running security scan..."

VULN_COUNT=0
VULN_REPORT=""

# Node.js - npm audit
if [ -f "package.json" ]; then
    if command -v npm >/dev/null 2>&1; then
        AUDIT_OUTPUT=$(npm audit --json 2>/dev/null || echo '{"metadata": {"vulnerabilities": {}}}')
        VULN_COUNT=$(echo "$AUDIT_OUTPUT" | grep -o '"total"' 2>/dev/null | wc -l || echo 0)
        CRITICAL=$(echo "$AUDIT_OUTPUT" | grep -o '"critical":[0-9]*' | cut -d: -f2 || echo 0)
        HIGH=$(echo "$AUDIT_OUTPUT" | grep -o '"high":[0-9]*' | cut -d: -f2 || echo 0)
        MODERATE=$(echo "$AUDIT_OUTPUT" | grep -o '"moderate":[0-9]*' | cut -d: -f2 || echo 0)
        LOW=$(echo "$AUDIT_OUTPUT" | grep -o '"low":[0-9]*' | cut -d: -f2 || echo 0)
        VULN_REPORT="npm: critical=$CRITICAL high=$HIGH moderate=$MODERATE low=$LOW"
        if [ "$CRITICAL" -gt 0 ] || [ "$HIGH" -gt 0 ]; then
            error "$VULN_REPORT"
        elif [ "$MODERATE" -gt 0 ] || [ "$LOW" -gt 0 ]; then
            warn "$VULN_REPORT"
        else
            success "No npm vulnerabilities found"
        fi
    else
        warn "npm not found, skipping node audit"
    fi
fi

# Python - pip-audit or safety
if [ -f "requirements.txt" ] || [ -f "pyproject.toml" ]; then
    if command -v pip-audit >/dev/null 2>&1; then
        AUDIT_OUTPUT=$(pip-audit --format=json 2>/dev/null || echo '{"dependencies": []}')
        PY_VULNS=$(echo "$AUDIT_OUTPUT" | grep -o '"vulns":' | wc -l || echo 0)
        if [ "$PY_VULNS" -gt 0 ]; then
            error "pip-audit found $PY_VULNS vulnerabilities"
        else
            success "No pip vulnerabilities found"
        fi
    elif command -v safety >/dev/null 2>&1; then
        SAFETY_OUTPUT=$(safety check --json 2>/dev/null || echo '[]')
        PY_VULNS=$(echo "$SAFETY_OUTPUT" | grep -c '"vulnerability_id"' || echo 0)
        if [ "$PY_VULNS" -gt 0 ]; then
            error "safety found $PY_VULNS vulnerabilities"
        else
            success "No safety vulnerabilities found"
        fi
    else
        warn "pip-audit/safety not installed, skipping Python vuln scan"
        echo "   Install: pip install pip-audit"
    fi
fi

# Rust - cargo audit
if [ -f "Cargo.toml" ]; then
    if command -v cargo-audit >/dev/null 2>&1; then
        AUDIT_OUTPUT=$(cargo audit --json 2>/dev/null || echo '{"vulnerabilities": {}}')
        RUST_VULNS=$(echo "$AUDIT_OUTPUT" | grep -o '"list":\[' | wc -l || echo 0)
        if [ "$RUST_VULNS" -gt 0 ]; then
            error "cargo-audit found vulnerabilities"
        else
            success "No cargo audit vulnerabilities found"
        fi
    else
        warn "cargo-audit not installed, skipping Rust vuln scan"
        echo "   Install: cargo install cargo-audit"
    fi
fi

# Go - govulncheck
if [ -f "go.mod" ]; then
    if command -v govulncheck >/dev/null 2>&1; then
        CHECK_OUTPUT=$(govulncheck -json ./... 2>/dev/null || echo '{"Vulns": []}')
        GO_VULNS=$(echo "$CHECK_OUTPUT" | grep -c '"OSV"' || echo 0)
        if [ "$GO_VULNS" -gt 0 ]; then
            error "govulncheck found $GO_VULNS vulnerabilities"
        else
            success "No govulncheck vulnerabilities found"
        fi
    else
        warn "govulncheck not installed, skipping Go vuln scan"
        echo "   Install: go install golang.org/x/vuln/cmd/govulncheck@latest"
    fi
fi

end_section

# ============================================
# DEPENDENCIES SCAN
# ============================================
start_section "dependencies"

info "Checking for outdated dependencies..."

# Node.js
if [ -f "package.json" ]; then
    if command -v npm >/dev/null 2>&1; then
        OUTDATED=$(npm outdated --json 2>/dev/null || echo '{}')
        COUNT=$(echo "$OUTDATED" | grep -o '\"' | wc -l)
        # Divide by 2 since each key has opening and closing quote
        COUNT=$((COUNT / 4))
        if [ "$COUNT" -gt 0 ]; then
            warn "npm: $COUNT outdated packages"
            echo "$OUTDATED" | grep -o '"[^"]*":' | sed 's/"//g; s/://' | head -10 | sed 's/^/   - /'
        else
            success "npm: all dependencies up to date"
        fi
    fi
fi

# Python
if [ -f "requirements.txt" ] && command -v pip >/dev/null 2>&1; then
    OUTDATED=$(pip list --outdated --format json 2>/dev/null || echo '[]')
    COUNT=$(echo "$OUTDATED" | grep -c '"name"' || echo 0)
    if [ "$COUNT" -gt 0 ]; then
        warn "pip: $COUNT outdated packages"
        echo "$OUTDATED" | grep -o '"name": "[^"]*"' | sed 's/.*"\([^"]*\)".*/\1/' | head -10 | sed 's/^/   - /'
    else
        success "pip: all dependencies up to date"
    fi
fi

# Rust
if [ -f "Cargo.toml" ]; then
    if command -v cargo-outdated >/dev/null 2>&1; then
        OUTDATED=$(cargo outdated --format json 2>/dev/null || echo '{"dependencies": []}')
        COUNT=$(echo "$OUTDATED" | grep -c '"project"' || echo 0)
        if [ "$COUNT" -gt 0 ]; then
            warn "cargo: $COUNT outdated crates"
        else
            success "cargo: all crates up to date"
        fi
    else
        warn "cargo-outdated not installed"
        echo "   Install: cargo install cargo-outdated"
    fi
fi

# Check for unused dependencies (Node.js)
if [ -f "package.json" ]; then
    if command -v depcheck >/dev/null 2>&1; then
        UNUSED=$(depcheck --json 2>/dev/null || echo '{"dependencies": [], "devDependencies": []}')
        UNUSED_COUNT=$(echo "$UNUSED" | grep -o '"dependencies": \[' | wc -l || echo 0)
        if [ "$UNUSED_COUNT" -gt 0 ]; then
            warn "Possible unused dependencies detected (run depcheck for details)"
        fi
    fi
fi

end_section

# ============================================
# CODE QUALITY SCAN
# ============================================
start_section "quality"

info "Running code quality checks..."

# ESLint (Node.js)
if [ -f ".eslintrc.js" ] || [ -f ".eslintrc.json" ] || [ -f ".eslintrc" ] || [ -f ".eslintrc.yml" ] || [ -f ".eslintrc.yaml" ]; then
    if command -v npx >/dev/null 2>&1; then
        ESLINT_OUTPUT=$(npx eslint . --ext .js,.jsx,.ts,.tsx --format json 2>/dev/null || echo '[]')
        ERROR_COUNT=$(echo "$ESLINT_OUTPUT" | grep -o '"errorCount":[0-9]*' | grep -o '[0-9]*' | awk '{s+=$1} END {print s}')
        WARNING_COUNT=$(echo "$ESLINT_OUTPUT" | grep -o '"warningCount":[0-9]*' | grep -o '[0-9]*' | awk '{s+=$1} END {print s}')
        if [ "$ERROR_COUNT" -gt 0 ] 2>/dev/null; then
            error "ESLint: $ERROR_COUNT errors, $WARNING_COUNT warnings"
        elif [ "$WARNING_COUNT" -gt 0 ] 2>/dev/null; then
            warn "ESLint: 0 errors, $WARNING_COUNT warnings"
        else
            success "ESLint: no issues"
        fi
    fi
fi

# Prettier (Node.js)
if [ -f ".prettierrc" ] || [ -f ".prettierrc.json" ] || [ -f ".prettierrc.js" ] || [ -f ".prettierrc.yml" ] || [ -f "prettier.config.js" ]; then
    if command -v npx >/dev/null 2>&1; then
        PRETTIER_ISSUES=$(npx prettier --check "**/*.{js,jsx,ts,tsx,json,md}" 2>&1 | grep -c "should be formatted" || echo 0)
        if [ "$PRETTIER_ISSUES" -gt 0 ]; then
            warn "Prettier: $PRETTIER_ISSUES files need formatting"
        else
            success "Prettier: all files formatted"
        fi
    fi
fi

# Ruff (Python)
if [ -f "pyproject.toml" ] || [ -f "ruff.toml" ]; then
    if command -v ruff >/dev/null 2>&1; then
        RUFF_OUTPUT=$(ruff check --output-format json . 2>/dev/null || echo '[]')
        RUFF_COUNT=$(echo "$RUFF_OUTPUT" | grep -c '"code"' || echo 0)
        if [ "$RUFF_COUNT" -gt 0 ]; then
            warn "Ruff: $RUFF_COUNT issues"
        else
            success "Ruff: no issues"
        fi
    fi
fi

# Black (Python)
if [ -f "pyproject.toml" ] && grep -q "black" pyproject.toml 2>/dev/null; then
    if command -v black >/dev/null 2>&1; then
        BLACK_ISSUES=$(black --check --diff . 2>&1 | grep -c "would reformat" || echo 0)
        if [ "$BLACK_ISSUES" -gt 0 ]; then
            warn "Black: $BLACK_ISSUES files need formatting"
        else
            success "Black: all files formatted"
        fi
    fi
fi

# Clippy (Rust)
if [ -f "Cargo.toml" ]; then
    if rustup component list 2>/dev/null | grep -q "clippy"; then
        CLIPPY_ISSUES=$(cargo clippy 2>&1 | grep -c "^warning:" || echo 0)
        if [ "$CLIPPY_ISSUES" -gt 0 ]; then
            warn "Clippy: $CLIPPY_ISSUES warnings"
        else
            success "Clippy: no warnings"
        fi
    fi
fi

# Go vet
if [ -f "go.mod" ]; then
    GO_VET_ISSUES=$(go vet ./... 2>&1 | grep -c ":" || echo 0)
    if [ "$GO_VET_ISSUES" -gt 0 ]; then
        warn "go vet: $GO_VET_ISSUES issues"
    else
        success "go vet: no issues"
    fi
fi

end_section

# ============================================
# MAINTENANCE SCAN
# ============================================
start_section "maintenance"

info "Running maintenance checks..."

# TODO/FIXME count
TODO_COUNT=$(grep -r "TODO\|FIXME\|XXX\|HACK" --include="*.py" --include="*.js" --include="*.ts" --include="*.go" --include="*.rs" . 2>/dev/null | grep -v node_modules | grep -v vendor | grep -v ".git" | wc -l || echo 0)
if [ "$TODO_COUNT" -gt 0 ]; then
    info "Found $TODO_COUNT TODO/FIXME/XXX/HACK comments"
else
    success "No TODO/FIXME comments found"
fi

# Large files (>1MB)
LARGE_FILES=$(find . -type f -size +1M 2>/dev/null | grep -v node_modules | grep -v ".git" | grep -v vendor | head -10)
LARGE_COUNT=$(echo "$LARGE_FILES" | grep -c "^\." || echo 0)
if [ "$LARGE_COUNT" -gt 0 ]; then
    warn "Found $LARGE_COUNT files >1MB:"
    echo "$LARGE_FILES" | head -5 | sed 's/^/   /'
fi

# Check for secrets/patterns (basic)
SECRETS=$(grep -r -l "password.*=\|api_key.*=\|secret.*=\|token.*=" --include="*.py" --include="*.js" --include="*.ts" . 2>/dev/null | grep -v node_modules | head -5 | wc -l || echo 0)
if [ "$SECRETS" -gt 0 ]; then
    warn "$SECRETS files contain potential hardcoded values (check manually)"
fi

# Git repo checks
if [ -d ".git" ]; then
    UNTRACKED=$(git ls-files --others --exclude-standard 2>/dev/null | wc -l || echo 0)
    if [ "$UNTRACKED" -gt 0 ]; then
        warn "$UNTRACKED untracked files"
    fi
fi

end_section

# Close JSON output
echo "}" >> "$OUTPUT_FILE"

echo ""
echo "========================================"
echo "              Summary"
echo "========================================"
echo ""
echo "Full report saved to: $OUTPUT_FILE"
echo ""
echo "To see JSON output: cat $OUTPUT_FILE"
echo ""

# Return appropriate exit code
if [ "$VULN_COUNT" -gt 0 ] 2>/dev/null; then
    exit 1
else
    exit 0
fi
