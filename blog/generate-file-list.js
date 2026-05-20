#!/usr/bin/env node
/**
 * blog/generate-file-list.js
 * Scans blog/posts/ for .md files and writes blog/file-list.json.
 *
 * Run:  node blog/generate-file-list.js
 * Or:   npm run bloglist
 */

const fs = require('fs');
const path = require('path');

const blogDir = __dirname;
const postsDir = path.join(blogDir, 'posts');
const outputFile = path.join(blogDir, 'file-list.json');

function getMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];

  entries.forEach((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(path.relative(blogDir, fullPath).replace(/\\/g, '/'));
    }
  });

  return files;
}

function generate() {
  const files = getMarkdownFiles(postsDir).sort((a, b) => a.localeCompare(b));
  fs.writeFileSync(outputFile, JSON.stringify(files, null, 2));
  console.log(`Generated ${outputFile} with ${files.length} files.`);
}

generate();
