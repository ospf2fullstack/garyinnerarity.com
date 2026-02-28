#!/usr/bin/env node
/**
 * generate-sitemap.js
 * Rebuilds sitemap.xml from:
 *   - Static site sections (hero, work, stack, credentials, notes, timeline)
 *   - Every note file listed in notes/file-list.json
 *
 * Run:  node generate-sitemap.js
 * Or:   npm run sitemap
 */

const fs   = require('fs');
const path = require('path');

const BASE_URL    = 'https://garyinnerarity.com';
const OUTPUT_FILE = path.join(__dirname, 'sitemap.xml');
const FILE_LIST   = path.join(__dirname, 'notes', 'file-list.json');
const TODAY       = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

// ── Static sections ────────────────────────────────────────────
const staticUrls = [
  { path: '/',             changefreq: 'monthly', priority: '1.0' },
  { path: '/#work',        changefreq: 'monthly', priority: '0.9' },
  { path: '/#stack',       changefreq: 'monthly', priority: '0.8' },
  { path: '/#credentials', changefreq: 'yearly',  priority: '0.8' },
  { path: '/#notes',       changefreq: 'weekly',  priority: '0.7' },
  { path: '/#timeline',    changefreq: 'monthly', priority: '0.6' },
];

// ── Note files ─────────────────────────────────────────────────
function getNoteUrls() {
  if (!fs.existsSync(FILE_LIST)) {
    console.warn(`⚠  ${FILE_LIST} not found — run: node notes/generate-file-list.js`);
    return [];
  }
  const files = JSON.parse(fs.readFileSync(FILE_LIST, 'utf8'));
  return files.map((file) => ({
    // e.g. notes/architecture and ops/basics.md → /#notes (anchor + encoded path in fragment)
    // Crawlers can't fetch JS-rendered content directly, so we point at the notes section.
    // The note path is included as a comment so it's visible in the sitemap source.
    path: `/#notes`,
    note: file,
    changefreq: 'weekly',
    priority: '0.5',
  }));
}

// ── Build XML ──────────────────────────────────────────────────
function buildSitemap(staticUrls, noteUrls) {
  const urlTags = [];

  staticUrls.forEach(({ path: p, changefreq, priority }) => {
    urlTags.push(`
  <url>
    <loc>${BASE_URL}${p}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`);
  });

  if (noteUrls.length > 0) {
    urlTags.push(`
  <!-- Notes knowledge base — ${noteUrls.length} files -->`);
    noteUrls.forEach(({ path: p, note, changefreq, priority }) => {
      urlTags.push(`
  <url><!-- ${note} -->
    <loc>${BASE_URL}${p}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`);
    });
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urlTags.join('')}

</urlset>
`;
}

// ── Run ────────────────────────────────────────────────────────
const noteUrls = getNoteUrls();
const xml      = buildSitemap(staticUrls, noteUrls);

fs.writeFileSync(OUTPUT_FILE, xml, 'utf8');
console.log(`✓ sitemap.xml written — ${staticUrls.length} static + ${noteUrls.length} notes (${TODAY})`);
