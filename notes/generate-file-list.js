#!/usr/bin/env node
const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const notesDir = __dirname; // Correctly point to the current directory
const outputFile = path.join(notesDir, 'file-list.json');

// Recursively get all .md files in the directory
function getMarkdownFiles(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  let markdownFiles = [];

  files.forEach(file => {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      markdownFiles = markdownFiles.concat(getMarkdownFiles(fullPath));
    } else if (file.isFile() && file.name.endsWith('.md')) {
      markdownFiles.push(path.relative(notesDir, fullPath).replace(/\\/g, '/'));
    }
  });

  return markdownFiles;
}

// Generate file-list.json
function generateFileList() {
  let markdownFiles = getMarkdownFiles(notesDir);
  markdownFiles = markdownFiles.sort((a, b) => {
    if (a === "Welcome.md") return -1; // Ensure "Welcome.md" is always first
    if (b === "Welcome.md") return 1;
    return a.localeCompare(b); // Sort the rest alphabetically
  });
  fs.writeFileSync(outputFile, JSON.stringify(markdownFiles, null, 2));
  console.log(`Generated ${outputFile} with ${markdownFiles.length} files.`);
}

generateFileList();

// Auto-regenerate sitemap whenever the file list changes
const sitemapScript = path.join(__dirname, '..', 'generate-sitemap.js');
if (fs.existsSync(sitemapScript)) {
  execSync(`node "${sitemapScript}"`, { stdio: 'inherit' });
}
