# garyinnerarity.com

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-Private-lightgrey)
![Deploy](https://img.shields.io/badge/deploy-GitHub%20Pages-222?logo=githubpages)
![HTML](https://img.shields.io/badge/HTML-CSS-JS-orange)

**Document Version:** v1.0.0
**Last Updated:** March 15, 2026

> Portfolio and knowledge base for Gary Innerarity — Solutions Engineer & MBA. Static site built with plain HTML, CSS, and vanilla JavaScript, deployed on GitHub Pages at [garyinnerarity.com](https://garyinnerarity.com).

---

## Overview

A personal portfolio and technical knowledge-base site showcasing enterprise projects, certifications, skills, and technical notes. Features an interactive 3D "Cognitive Architecture" brain visualization, a client-side Markdown knowledge base, and a timeline of career events.

**Key highlights:**

- 14+ industry certifications (AWS, Cisco, CompTIA, Databricks, Google, Microsoft)
- Enterprise-grade project portfolio (Agentic AI, Digital Thread, Digital Twin, Compliance Automation)
- Client-side rendered Markdown notes and skills with search, wikilinks, and Mermaid diagram support
- Interactive Three.js brain visualization
- Particle.js animated background
- SEO-optimized with structured data, Open Graph, and AI/LLM crawler permissions

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Content Management](#content-management)
- [Build & Deploy](#build--deploy)
- [Scripts](#scripts)
- [Contributing](#contributing)

## Tech Stack

| Layer         | Technology                                                |
| ------------- | --------------------------------------------------------- |
| Markup        | HTML5, CSS3 (custom properties), vanilla JavaScript       |
| 3D Viz        | Three.js r128 (CDN)                                      |
| Markdown      | marked.js, highlight.js, mermaid.js (CDN)                |
| Particles     | particles.js (CDN)                                       |
| Hosting       | GitHub Pages with custom domain                           |
| CI/CD         | GitHub Actions (`.github/workflows/static.yml`)           |
| Linting       | ESLint 8                                                  |

## Project Structure

```
├── index.html              # Main portfolio site
├── index-brain.html        # 3D Cognitive Architecture brain visualization
├── styles.css              # Global styles (CSS custom properties)
├── script.js               # Main site logic
├── events.json             # Timeline events
├── llms.txt                # AI-readable site summary
├── generate-sitemap.js     # Sitemap generator
├── notes/                  # Markdown knowledge-base articles
│   ├── file-list.json      # Auto-generated note index
│   └── generate-file-list.js
├── skills/                 # Markdown technical skill write-ups
│   ├── file-list.json      # Auto-generated skill index
│   └── generate-file-list.js
├── scripts/                # JS modules (particles, visitor counter, quotes, certs)
├── assets/                 # Images, certificates, global assets
│   ├── certs/
│   ├── github/
│   └── globals/
└── .github/workflows/      # GitHub Actions deployment pipeline
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- npm (included with Node.js)

### Setup

```bash
git clone https://github.com/garyinnerarity/garyinnerarity.com.git
cd garyinnerarity.com
npm install
```

### Local Preview

Open `index.html` directly in a browser, or use any static file server:

```bash
npx serve .
```

## Content Management

### Notes & Skills

Markdown files in `notes/` and `skills/` are rendered client-side via marked.js.

- Every `.md` file must start with a single `# Title` on line 1 (used as sidebar display name)
- No YAML frontmatter — the site does not parse it
- Wikilinks supported: `[[Note Name]]` resolves to the matching filename
- Subdirectory names become sidebar group names
- Fenced code blocks are syntax-highlighted; Mermaid diagrams are supported

After adding or removing any `.md` file:

```bash
npm run build
```

### Timeline Events

Append entries to `events.json` following this schema:

```json
{
  "date": "YYYY-MM-DD",
  "title": "Short title",
  "description": "Brief description of the event.",
  "type": "project | training | health | career"
}
```

## Build & Deploy

### Build

Regenerates file lists and sitemap:

```bash
npm run build
```

This runs:
1. `node notes/generate-file-list.js` → `notes/file-list.json`
2. `node skills/generate-file-list.js` → `skills/file-list.json`
3. `node generate-sitemap.js` → `sitemap.xml`

### Deploy

Deployment is automatic via GitHub Actions on push to `main`:
1. Checkout → Setup Node 20 → `npm run build`
2. Remove dev-only files listed in `.pagesignore`
3. Upload artifact → Deploy to GitHub Pages

The live site is served at **[garyinnerarity.com](https://garyinnerarity.com)**.

## Scripts

| Command             | Description                                      |
| ------------------- | ------------------------------------------------ |
| `npm run build`     | Regenerate file lists + sitemap                  |
| `npm run filelist`  | Regenerate `notes/file-list.json` only           |
| `npm run skillslist`| Regenerate `skills/file-list.json` only          |
| `npm run sitemap`   | Regenerate `sitemap.xml` only                    |
| `npm run lint`      | Run ESLint across JS files                       |

## Contributing

This is a personal portfolio site. For bugs or suggestions, open an issue on the [GitHub repository](https://github.com/garyinnerarity/garyinnerarity.com).

---

<div align="center">
    <sub>Powered by <strong>Gary Innerarity</strong></sub>
</div>
