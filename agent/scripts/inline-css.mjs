#!/usr/bin/env node
/**
 * Inline agent/site/style.css into each HTML file's <head> as a <style> tag,
 * replacing the external <link rel="stylesheet"> reference.
 *
 * WHY (HB#319 Hudson screenshot review): when each HTML is pinned individually
 * to IPFS, the CSS link points at a separate CID. ipfs.io serves CSS files with
 * Content-Type: text/plain (no .css extension to detect from), and modern
 * browsers refuse to apply non-text/css stylesheets in strict mode. Result:
 * pages render with browser defaults (Times New Roman, white background).
 *
 * Inlining the CSS makes each page self-contained — no external dependency,
 * no MIME-type negotiation. Each pinned CID is a complete styled document.
 *
 * Usage:
 *   node agent/scripts/inline-css.mjs              # rewrite ALL .html files
 *   node agent/scripts/inline-css.mjs for-hire     # rewrite single page
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const SITE = new URL('../site/', import.meta.url).pathname;
const STYLE_PATH = join(SITE, 'style.css');
const cssContent = readFileSync(STYLE_PATH, 'utf8');

// Strip the absolute IPFS link and inline the CSS in its place.
// Match either the absolute URL form (post-rewrite) or relative form (pre-rewrite).
const LINK_PATTERN = /<link\s+rel="stylesheet"\s+href="[^"]+"\s*\/?>/i;
const INLINE = `<style>\n${cssContent}\n  </style>`;

function processFile(htmlPath) {
  let content = readFileSync(htmlPath, 'utf8');
  if (!LINK_PATTERN.test(content)) {
    if (content.includes('<style>')) {
      console.log(`  ${htmlPath}: already inlined, skipping`);
      return false;
    }
    console.log(`  ${htmlPath}: no <link rel="stylesheet"> found — manual inspection`);
    return false;
  }
  content = content.replace(LINK_PATTERN, INLINE);
  writeFileSync(htmlPath, content);
  console.log(`  ${htmlPath}: inlined ${cssContent.length}B of CSS`);
  return true;
}

const targetArg = process.argv[2];
if (targetArg) {
  // Single-page mode: 'for-hire' → 'for-hire.html'
  const file = targetArg.endsWith('.html') ? targetArg : `${targetArg}.html`;
  const path = join(SITE, file);
  if (!statSync(path).isFile()) {
    console.error(`not found: ${path}`);
    process.exit(1);
  }
  processFile(path);
} else {
  // Bulk mode: every .html in agent/site/
  const files = readdirSync(SITE)
    .filter(f => f.endsWith('.html'))
    .map(f => join(SITE, f));
  console.log(`processing ${files.length} HTML file(s)`);
  let changed = 0;
  for (const f of files) {
    if (processFile(f)) changed++;
  }
  console.log(`\n${changed} file(s) updated`);
  console.log('Next: re-run pin-site-individual.mjs to get fresh CIDs, then pop org update-metadata.');
}
