#!/usr/bin/env node
/**
 * Pin each agent/site/ file individually (one CID per file).
 *
 * Per Hudson HB#315: The Graph IPFS hashes filenames in directory mode
 * (HB#309 finding); single-file pins preserve content addressing per
 * file. Cross-page nav inside HTML breaks across-CID — entry is the
 * org dashboard which has 6 separate links.
 *
 * Run: node agent/scripts/pin-site-individual.mjs
 *
 * Output: a JSON map {filename: cid} written to stdout + saved to
 * agent/site/cids.json for use by the metadata-update step.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
import { pinFile } from '../../dist/lib/ipfs.js';

const SITE = new URL('../site/', import.meta.url).pathname;
const OUT = join(SITE, 'cids.json');

const files = readdirSync(SITE)
  .filter(f => statSync(join(SITE, f)).isFile())
  .filter(f => !f.endsWith('.json')); // skip cids.json itself

console.log(`pinning ${files.length} file(s) individually`);
const cids = {};
for (const f of files) {
  const content = readFileSync(join(SITE, f));
  const cid = await pinFile(content);
  cids[f] = cid;
  console.log(`  ${f.padEnd(24)} -> ${cid}  (${content.length}B)`);
}

writeFileSync(OUT, JSON.stringify(cids, null, 2) + '\n');
console.log('');
console.log(`saved CID map to ${OUT}`);
console.log('');
console.log('Gateway URLs:');
for (const [f, cid] of Object.entries(cids)) {
  console.log(`  ${f.padEnd(24)} https://ipfs.io/ipfs/${cid}`);
}
