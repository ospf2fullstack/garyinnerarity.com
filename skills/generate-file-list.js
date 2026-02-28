#!/usr/bin/env node
/**
 * skills/generate-file-list.js
 * Scans the skills/ directory for .md files and writes skills/file-list.json.
 * Also triggers sitemap regeneration.
 *
 * Run:  node skills/generate-file-list.js
 * Or:   npm run skillslist
 */

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const skillsDir  = __dirname;
const outputFile = path.join(skillsDir, 'file-list.json');

function getMarkdownFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  entries.forEach((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(path.relative(skillsDir, fullPath).replace(/\\/g, '/'));
    }
  });
  return files;
}

function generate() {
  const files = getMarkdownFiles(skillsDir).sort((a, b) => a.localeCompare(b));
  fs.writeFileSync(outputFile, JSON.stringify(files, null, 2));
  console.log(`Generated ${outputFile} with ${files.length} files.`);
}

generate();

const sitemapScript = path.join(__dirname, '..', 'generate-sitemap.js');
if (fs.existsSync(sitemapScript)) {
  execSync(`node "${sitemapScript}"`, { stdio: 'inherit' });
}
