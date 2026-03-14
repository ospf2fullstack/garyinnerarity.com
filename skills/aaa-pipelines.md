# AAA-Pipelines: Accelerated, Agentic, Autonomous Pipelines

A DevSecOps pipeline framework that uses LLM-powered agents to continuously scan codebases for bugs and vulnerabilities, auto-generate patches, validate fixes locally, and open merge requests with full context — no human in the loop until review.

## Overview

Traditional CI/CD pipelines are **reactive**: they run linters and tests after a developer pushes code. AAA-Pipelines inverts the model. The pipeline **proactively** discovers issues, authors fixes, and presents them as ready-to-merge pull requests — each with a clear problem statement, root cause analysis, proposed patch, and test results.

The three A's:

- **Accelerated** — Parallelized scanning across multiple tool classes (SAST, SCA, secrets, a11y, config audit) with results funneled into a unified findings schema. No sequential bottlenecks.
- **Agentic** — An LLM agent sits at the core of the remediation loop. It receives structured findings, reasons about the codebase, generates patches, and iterates on failures — using the same plan-execute-observe loop that powers autonomous AI agents.
- **Autonomous** — The full cycle — scan, triage, patch, test, open PR — runs without human intervention. Humans review and approve; the pipeline does everything else.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AAA-Pipeline Orchestrator                    │
│                     (GitHub Actions / CI Runner)                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  SAST Scanner │  │  SCA Scanner  │  │ Secret Detect│  ... more   │
│  │  (Semgrep,    │  │  (Trivy,      │  │ (Gitleaks,   │  scanners   │
│  │   ESLint,     │  │   npm audit,  │  │  TruffleHog) │              │
│  │   Bandit)     │  │   Snyk)       │  │              │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                  │                  │                      │
│         └──────────────────┼──────────────────┘                     │
│                            ▼                                        │
│                ┌──────────────────────┐                             │
│                │  Findings Normalizer  │                             │
│                │  (Unified JSON Schema)│                             │
│                └──────────┬───────────┘                             │
│                           ▼                                         │
│                ┌──────────────────────┐                             │
│                │    Triage & Dedup     │                             │
│                │  (Severity, CWE,     │                             │
│                │   fingerprinting)     │                             │
│                └──────────┬───────────┘                             │
│                           ▼                                         │
│              ┌────────────────────────┐                             │
│              │   Agentic Patch Loop   │◄──── LLM (GPT-4o /        │
│              │                        │       Claude / Local)       │
│              │  1. Receive finding    │                             │
│              │  2. Read relevant code │                             │
│              │  3. Generate patch     │                             │
│              │  4. Apply & test       │                             │
│              │  5. Iterate on failure │                             │
│              │  6. Produce report     │                             │
│              └────────────┬───────────┘                             │
│                           ▼                                         │
│              ┌────────────────────────┐                             │
│              │   PR / MR Generator    │                             │
│              │  - Branch per finding  │                             │
│              │  - Structured body     │                             │
│              │  - Test results        │                             │
│              │  - Confidence score    │                             │
│              └────────────────────────┘                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## The Unified Findings Schema

Every scanner — regardless of vendor or category — normalizes its output into a single schema. This is what the agentic loop consumes.

```json
{
  "finding_id": "SAST-semgrep-xss-034",
  "source": "semgrep",
  "category": "SAST",
  "severity": "high",
  "cwe": "CWE-79",
  "title": "Reflected XSS via unsanitized user input",
  "description": "User-controlled input is rendered directly into HTML without escaping.",
  "file": "src/handlers/profile.js",
  "line_start": 47,
  "line_end": 47,
  "snippet": "res.send(`<h1>Welcome, ${req.query.name}</h1>`);",
  "fingerprint": "a3f8c2...",
  "first_seen": "2025-11-01T08:30:00Z",
  "remediation_hint": "Use a templating engine with auto-escaping or sanitize input with DOMPurify."
}
```

## Scanner Matrix

AAA-Pipelines is scanner-agnostic. The framework provides normalizer adapters for each tool, mapping vendor-specific output to the unified schema.

| Category | Tools | What It Catches |
|---|---|---|
| **SAST** | Semgrep, ESLint (security plugins), Bandit, CodeQL | Code-level bugs, injection, XSS, logic flaws |
| **SCA / Supply Chain** | Trivy, npm audit, Snyk, OSV-Scanner | Vulnerable dependencies, outdated packages, license violations |
| **Secret Detection** | Gitleaks, TruffleHog, detect-secrets | API keys, tokens, passwords committed to source |
| **Security Config** | Checkov, tfsec, KICS | IaC misconfigurations, missing security headers, CSP gaps |
| **Accessibility** | axe-core, pa11y, Lighthouse | WCAG violations, missing alt text, ARIA issues, contrast |
| **Container / Image** | Trivy, Grype, Dockle | Image CVEs, root user, unnecessary packages |
| **DAST** (optional) | OWASP ZAP, Nuclei | Runtime vulnerabilities, misconfigs in deployed environments |

## The Agentic Patch Loop

This is the core differentiator. Instead of dumping a spreadsheet of findings on a developer, the pipeline **attempts to fix each issue autonomously** using an LLM agent.

```python
import json
from pathlib import Path
from openai import OpenAI

client = OpenAI()

SYSTEM_PROMPT = """You are a senior security engineer and software developer.
You will receive a structured vulnerability finding and the relevant source code.
Your job:
1. Analyze the root cause of the vulnerability.
2. Produce a minimal, correct patch that resolves the issue without breaking functionality.
3. Explain your reasoning in 2-3 sentences.
4. If you cannot safely fix the issue, say so and explain why.

Return your response as JSON:
{
  "patch": "unified diff format string",
  "explanation": "why this fix is correct",
  "confidence": 0.0-1.0,
  "breaking_risk": "none | low | medium | high",
  "needs_human_review": true/false
}"""

def generate_patch(finding: dict, source_code: str) -> dict:
    """
    Send a finding + source context to the LLM and receive a structured patch.
    """
    user_message = json.dumps({
        "finding": finding,
        "source_code": source_code,
        "file_path": finding["file"],
    }, indent=2)

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        response_format={"type": "json_object"},
        temperature=0.1,  # low creativity — we want precision
    )

    return json.loads(response.choices[0].message.content)


def agentic_remediation_loop(finding: dict, max_retries: int = 3) -> dict:
    """
    Full agentic loop: generate patch → apply → test → retry on failure.
    """
    source_code = Path(finding["file"]).read_text()

    for attempt in range(1, max_retries + 1):
        # 1. Generate patch
        result = generate_patch(finding, source_code)

        # 2. Apply patch to a temporary branch
        patch_applied = apply_patch(finding["file"], result["patch"])
        if not patch_applied:
            result["status"] = "patch_failed"
            continue

        # 3. Run local validation
        test_result = run_local_tests()

        if test_result["passed"]:
            result["status"] = "fix_verified"
            result["test_output"] = test_result["output"]
            result["attempts"] = attempt
            return result

        # 4. Feed failure back to agent for iteration
        source_code = (
            f"Previous patch attempt failed.\n"
            f"Test output:\n{test_result['output']}\n\n"
            f"Original source:\n{Path(finding['file']).read_text()}"
        )

    result["status"] = "max_retries_exhausted"
    result["needs_human_review"] = True
    return result
```

## PR Generation

Each finding gets its own branch and pull request with a structured body that tells the full story:

```markdown
## [AAA-Pipeline] Fix: Reflected XSS via unsanitized user input

**Finding ID:** SAST-semgrep-xss-034
**Severity:** High | **CWE:** CWE-79
**Scanner:** Semgrep | **Category:** SAST
**File:** `src/handlers/profile.js:47`

---

### Problem
User-controlled input from `req.query.name` is interpolated directly into an HTML
response without sanitization, enabling reflected cross-site scripting (XSS).

### Root Cause
The handler uses a template literal to construct HTML, bypassing any escaping
mechanism. An attacker can inject arbitrary JavaScript via the `name` query parameter.

### Fix Applied
Replaced raw string interpolation with `he.encode()` for HTML entity escaping.

```diff
- res.send(`<h1>Welcome, ${req.query.name}</h1>`);
+ const he = require('he');
+ res.send(`<h1>Welcome, ${he.encode(req.query.name)}</h1>`);
```

### Validation
| Check | Result |
|---|---|
| Unit tests | Passed (42/42) |
| Integration tests | Passed (18/18) |
| Re-scan (Semgrep) | Finding resolved |
| Breaking risk | None |

**Agent confidence:** 94%
**Attempts:** 1 of 3

---
*Generated by AAA-Pipelines v1.0 — Accelerated, Agentic, Autonomous*
```

## GitHub Actions Integration

```yaml
name: AAA-Pipeline
on:
  schedule:
    - cron: '0 6 * * 1'    # Weekly Monday 6 AM UTC
  workflow_dispatch:         # Manual trigger

permissions:
  contents: write
  pull-requests: write
  security-events: write

jobs:
  scan:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        scanner: [semgrep, trivy, gitleaks, eslint-security, axe-core]
    steps:
      - uses: actions/checkout@v4

      - name: Run ${{ matrix.scanner }}
        run: |
          ./aaa-pipelines/scanners/${{ matrix.scanner }}/run.sh
          # Each scanner outputs to ./findings/${{ matrix.scanner }}.json

      - uses: actions/upload-artifact@v4
        with:
          name: findings-${{ matrix.scanner }}
          path: ./findings/

  remediate:
    needs: scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/download-artifact@v4
        with:
          path: ./findings/
          merge-multiple: true

      - name: Normalize & Deduplicate Findings
        run: python aaa-pipelines/normalize.py ./findings/ > unified-findings.json

      - name: Agentic Remediation Loop
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: python aaa-pipelines/remediate.py unified-findings.json

      - name: Generate Pull Requests
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: python aaa-pipelines/create_prs.py
```

## Pipeline Configuration

```yaml
# aaa-pipelines.yaml — project-level configuration
version: "1.0"
project:
  name: my-application
  language: javascript
  test_command: "npm test"
  build_command: "npm run build"

scanners:
  enabled:
    - semgrep
    - trivy
    - gitleaks
    - eslint-security
    - axe-core
  custom_rules_dir: .aaa-pipelines/rules/

agent:
  model: gpt-4o                    # LLM for patch generation
  temperature: 0.1                 # Low temp = precise patches
  max_retries: 3                   # Retry attempts per finding
  confidence_threshold: 0.7        # Below this → flag for human review
  context_window_lines: 50         # Lines of surrounding code to include

triage:
  severity_threshold: medium       # Ignore low-severity findings
  auto_merge_confidence: 0.95      # Auto-merge PRs above this confidence
  deduplicate: true                # Fingerprint-based dedup across runs
  ignore_paths:
    - "node_modules/**"
    - "vendor/**"
    - "*.test.js"

pr:
  branch_prefix: "aaa-fix/"
  label: "aaa-pipeline"
  assignee: "@security-team"
  max_open_prs: 10                 # Circuit breaker — don't flood the repo
```

## Key Design Principles

1. **Scanner-agnostic**: The framework doesn't care where findings come from. Write a normalizer adapter, plug in any tool.
2. **Finding-as-story**: Every PR tells a complete narrative — problem, root cause, fix, validation. Reviewers should never need to context-switch to understand what happened.
3. **Fail-safe by default**: If the agent can't fix it confidently, it says so. The `needs_human_review` flag and confidence score prevent bad patches from sneaking through.
4. **Idempotent runs**: Fingerprinting and deduplication ensure the same finding doesn't generate duplicate PRs across pipeline runs.
5. **Circuit breakers**: `max_open_prs`, severity thresholds, and confidence gates prevent the pipeline from overwhelming a team or introducing regressions.

## Comparison with Traditional DevSecOps

| Dimension | Traditional Pipeline | AAA-Pipeline |
|---|---|---|
| **Discovery** | Reactive (scan on push) | Proactive (scheduled + event-driven) |
| **Output** | Alert / dashboard entry | Ready-to-merge pull request |
| **Remediation** | Manual developer effort | LLM-generated patch with validation |
| **Context** | "Line 47 has a vulnerability" | Full story: problem, cause, fix, test results |
| **Triage** | Human sorts through noise | Auto-dedup, severity filter, confidence scoring |
| **Feedback loop** | Days to weeks | Minutes (scan → patch → PR in one run) |
| **Scale** | Limited by developer bandwidth | Parallelized, bounded only by compute |

## Notes

- The agentic patch loop uses the same plan-execute-observe pattern described in the [Agentic Loop](agentic-loop.md) skill — applied to security remediation rather than general-purpose tasks.
- Pair AAA-Pipelines with [Structured Output](structured-output.md) to ensure the LLM's patch responses are always schema-compliant and machine-parseable.
- For organizations running private models, swap the OpenAI client for any OpenAI-compatible API (vLLM, Ollama, Azure OpenAI) — the framework is model-agnostic.
- Start with SAST and secret detection. These have the highest signal-to-noise ratio and the most automatable fixes. Layer in SCA, a11y, and DAST as the pipeline matures.
- The `auto_merge_confidence` threshold should be set conservatively (0.95+) and only enabled after the team has manually reviewed at least 50 pipeline-generated PRs to build trust in the agent's output.
