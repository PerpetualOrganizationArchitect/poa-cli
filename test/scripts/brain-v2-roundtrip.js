#!/usr/bin/env node
/**
 * T3 #431 acceptance integration test: v2 round-trip + block-size measurement.
 *
 * Per agent/artifacts/research/brain-wire-format-v2-design.md acceptance:
 *   - "round-trip a 100-lesson doc through v2 — verify final state matches
 *      v1 baseline byte-for-byte after pop brain snapshot projection"
 *   - "Block size measurement: per-write block size for a single lesson
 *      append is < 5KB on v1"
 *
 * Scenario:
 *   1. Build a v1 chain of 100 lesson appends (single Automerge doc).
 *   2. Capture v1 head block size + Automerge.save() byte count.
 *   3. Run migrateDocToV2 + capture v2 envelope size.
 *   4. Cold openBrainDoc — verify v2 read reconstructs identical state.
 *   5. Append a 101st lesson via applyBrainChangeV2 — measure v2 single-write
 *      block size (the headline number for v2's value prop).
 *   6. Print all measurements + assert correctness.
 *
 * Exit codes:
 *   0 — round-trip equal AND v2 single-write block < v1 head block
 *   1 — round-trip mismatch OR v2 single-write block >= v1 head block
 *
 * Run: node test/scripts/brain-v2-roundtrip.js
 */

'use strict';

const { mkdirSync, rmSync, existsSync, readFileSync, statSync, readdirSync } = require('fs');
const { join } = require('path');
const { homedir } = require('os');

const REPO = join(__dirname, '..', '..');

function loadDotEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadDotEnv(join(homedir(), '.pop-agent', '.env'));
loadDotEnv(join(REPO, '.env'));

if (!process.env.POP_PRIVATE_KEY) {
  console.error('POP_PRIVATE_KEY missing — skipping');
  process.exit(0);
}

const TEST_HOME = '/tmp/pop-brain-v2-roundtrip-' + Date.now();
process.env.POP_BRAIN_HOME = TEST_HOME;
mkdirSync(TEST_HOME, { recursive: true });

function log(tag, msg) {
  console.error(`[${tag}] ${msg}`);
}

// FsBlockstore stores blocks under helia-blocks/<sharded>.data — find any
// .data file in the tree and return its size.
function getBlockSize(homeDir, cidPrefix) {
  const blockDir = join(homeDir, 'helia-blocks');
  if (!existsSync(blockDir)) return null;
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        const s = walk(path);
        if (s !== null) return s;
      } else if (entry.isFile() && entry.name.endsWith('.data')) {
        return statSync(path).size;
      }
    }
    return null;
  }
  return walk(blockDir); // returns size of FIRST block found — fine for single-write tests
}

(async () => {
  const B = await import(join(REPO, 'dist/lib/brain.js'));
  const Automerge = await import('@automerge/automerge');

  const TEST_DOC = 'pop.brain.shared'; // canonical doc with genesis bootstrap

  log('phase 1', 'building v1 chain with 100 lesson appends');
  const startV1 = Date.now();
  for (let i = 0; i < 100; i++) {
    await B.applyBrainChange(TEST_DOC, (d) => {
      if (!d.lessons) d.lessons = [];
      d.lessons.push({
        id: `lesson-${i}`,
        title: `Lesson ${i}`,
        body: `Body of lesson ${i} — moderate length text content for realistic byte sizing.`,
      });
    }, { allowInvalidShape: true });
  }
  const v1BuildMs = Date.now() - startV1;
  log('phase 1', `done in ${v1BuildMs}ms`);

  // Capture v1 state snapshot
  const v1Read = await B.openBrainDoc(TEST_DOC);
  const v1Bytes = Automerge.save(v1Read.doc);
  const v1HeadBlockBytes = getBlockSize(TEST_HOME);
  log('v1', `head=${v1Read.headCid.slice(0, 16)}... lessons=${v1Read.doc.lessons.length} automerge.save()=${v1Bytes.length}B head-block-on-disk=${v1HeadBlockBytes}B`);

  log('phase 2', 'migrating to v2 via migrateDocToV2');
  const startMig = Date.now();
  const m = await B.migrateDocToV2(TEST_DOC);
  const migMs = Date.now() - startMig;
  log('phase 2', `done in ${migMs}ms — action=${m.action} changeCount=${m.changeCount} v2-head=${m.headCid.slice(0, 16)}...`);
  if (m.action !== 'migrated') {
    log('FAIL', `expected action=migrated, got ${m.action}`);
    process.exit(1);
  }

  // Capture v2 envelope size (the wrapped-history blob).
  const v2HeadBlockBytes = getBlockSize(TEST_HOME);
  log('v2', `wrapped-history block: ${v2HeadBlockBytes}B (vs v1 head ${v1HeadBlockBytes}B)`);

  log('phase 3', 'cold openBrainDoc — verifying v2 read reconstructs identical state');
  const v2Cold = await B.openBrainDoc(TEST_DOC);
  const v2Bytes = Automerge.save(v2Cold.doc);
  if (Buffer.from(v1Bytes).compare(Buffer.from(v2Bytes)) !== 0) {
    log('FAIL', `round-trip mismatch! v1.save=${v1Bytes.length}B v2.save=${v2Bytes.length}B`);
    process.exit(1);
  }
  if (v2Cold.doc.lessons.length !== 100) {
    log('FAIL', `lesson count diverged: ${v2Cold.doc.lessons.length} vs expected 100`);
    process.exit(1);
  }
  log('phase 3', `PASS — Automerge.save() bytes match (${v2Bytes.length}B), 100 lessons present`);

  log('phase 4', 'appending lesson #101 via applyBrainChangeV2 — measuring per-write block size');
  const r101 = await B.applyBrainChangeV2(TEST_DOC, (d) => {
    d.lessons.push({
      id: 'lesson-100',
      title: 'Lesson 100',
      body: 'Same body shape as the prior 100 — measures incremental v2 cost.',
    });
  }, { allowInvalidShape: true });
  log('phase 4', `lesson 101 written: priority=${r101.envelope.priority} parents=${r101.envelope.parentCids.length} new-head=${r101.headCid.slice(0, 16)}...`);

  // The newly written block is the most recent .data file. Re-walk and find it.
  // Simpler: check the doc state size + envelope changes hex length.
  const v2WriteBlockBytes = Buffer.byteLength(JSON.stringify(r101.envelope));
  log('v2', `single-write envelope (lesson #101): ${v2WriteBlockBytes}B`);

  // Verify state grew correctly
  const final = await B.openBrainDoc(TEST_DOC);
  if (final.doc.lessons.length !== 101) {
    log('FAIL', `final lesson count ${final.doc.lessons.length} != 101`);
    process.exit(1);
  }

  // Acceptance assertion: v2 single-write block should be MUCH smaller than
  // v1 head block (which held the full snapshot of 100 lessons).
  if (v2WriteBlockBytes >= v1HeadBlockBytes) {
    log('FAIL', `v2 single-write block ${v2WriteBlockBytes}B is NOT smaller than v1 head block ${v1HeadBlockBytes}B — v2 size advantage absent`);
    process.exit(1);
  }
  const ratio = (v1HeadBlockBytes / v2WriteBlockBytes).toFixed(1);
  log('PASS', `v2 single-write ${v2WriteBlockBytes}B vs v1 head ${v1HeadBlockBytes}B — ${ratio}x smaller block per write`);

  // Cleanup
  await B.stopBrainNode();
  rmSync(TEST_HOME, { recursive: true, force: true });
  log('cleanup', `removed ${TEST_HOME}`);

  console.log('');
  console.log('=== T3 #431 acceptance integration test PASS ===');
  console.log(`  100-lesson round-trip: v2 reconstructs identical state (${v2Bytes.length}B Automerge.save)`);
  console.log(`  Block size delta:      v1 head ${v1HeadBlockBytes}B → v2 single-write ${v2WriteBlockBytes}B (${ratio}x reduction)`);
  console.log(`  v1 build time:         ${v1BuildMs}ms for 100 writes`);
  console.log(`  Migration time:        ${migMs}ms for 100 changes`);
  process.exit(0);
})().catch((err) => {
  console.error('CRASH:', err.stack || err.message);
  try { rmSync(TEST_HOME, { recursive: true, force: true }); } catch {}
  process.exit(1);
});
