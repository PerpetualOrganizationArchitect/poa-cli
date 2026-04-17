#!/usr/bin/env node
/**
 * Pin agent/site/ as an IPFS directory and print the wrapping CID.
 *
 * Run: node agent/scripts/pin-site.mjs
 *
 * Output:
 *   wrapping CID: Qm...
 *   gateway:      https://ipfs.io/ipfs/Qm.../index.html
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { pinDirectory } from '../../dist/lib/ipfs.js';

const SITE = new URL('../site/', import.meta.url).pathname;

function walk(dir) {
  const entries = readdirSync(dir);
  const out = [];
  for (const e of entries) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) {
      out.push(...walk(p));
    } else if (st.isFile()) {
      out.push({
        path: relative(SITE, p),
        content: readFileSync(p),
      });
    }
  }
  return out;
}

const files = walk(SITE);
console.log(`pinning ${files.length} file(s) from ${SITE}`);
for (const f of files) {
  console.log(`  - ${f.path} (${f.content.length}B)`);
}

const cid = await pinDirectory(files);
console.log('');
console.log(`wrapping CID: ${cid}`);
console.log(`gateway:      https://ipfs.io/ipfs/${cid}/index.html`);
