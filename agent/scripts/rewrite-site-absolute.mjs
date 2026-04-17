#!/usr/bin/env node
/**
 * Rewrite agent/site/*.html to use absolute IPFS gateway URLs for
 * style.css + intra-site nav links. Uses the CIDs in agent/site/cids.json
 * (produced by pin-site-individual.mjs).
 *
 * After this rewrite, re-pin each file (running pin-site-individual.mjs
 * again) — the second-pass CIDs are stable because the rewritten files
 * have no further-changing references.
 *
 * Usage:
 *   node agent/scripts/rewrite-site-absolute.mjs           # rewrite in place
 *   node agent/scripts/rewrite-site-absolute.mjs --dry     # print diff only
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const SITE = new URL('../site/', import.meta.url).pathname;
const CIDS_PATH = join(SITE, 'cids.json');
const GATEWAY = 'https://ipfs.io/ipfs/';
const DRY = process.argv.includes('--dry');

if (!existsSync(CIDS_PATH)) {
  console.error(`missing ${CIDS_PATH} — run pin-site-individual.mjs first`);
  process.exit(1);
}
const cids = JSON.parse(readFileSync(CIDS_PATH, 'utf8'));

// Files we rewrite are the .html ones. style.css gets pinned but doesn't need rewriting.
const htmls = Object.keys(cids).filter(f => f.endsWith('.html'));
console.log(`rewriting ${htmls.length} HTML file(s) — ${DRY ? 'DRY RUN' : 'IN PLACE'}`);

for (const htmlFile of htmls) {
  const path = join(SITE, htmlFile);
  let content = readFileSync(path, 'utf8');
  const original = content;

  // 1. Rewrite style.css href to absolute IPFS URL.
  content = content.replace(
    /href="style\.css"/g,
    `href="${GATEWAY}${cids['style.css']}"`,
  );

  // 2. Rewrite each intra-site nav link to absolute IPFS URL.
  for (const otherHtml of htmls) {
    if (otherHtml === htmlFile) continue; // self-link stays relative (no harm)
    content = content.replace(
      new RegExp(`href="${otherHtml.replace('.', '\\.')}"`, 'g'),
      `href="${GATEWAY}${cids[otherHtml]}"`,
    );
  }

  if (content === original) {
    console.log(`  ${htmlFile}: no changes`);
    continue;
  }

  if (DRY) {
    const changed = content.split('\n').filter((l, i) => l !== original.split('\n')[i]).length;
    console.log(`  ${htmlFile}: ~${changed} lines would change`);
  } else {
    writeFileSync(path, content);
    console.log(`  ${htmlFile}: rewritten`);
  }
}

console.log('');
if (!DRY) {
  console.log('Next: re-run node agent/scripts/pin-site-individual.mjs to get the FINAL CIDs');
}
