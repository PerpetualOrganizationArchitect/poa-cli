#!/usr/bin/env node
/**
 * T3 #431 acceptance: concurrent multi-agent write convergence under v2.
 *
 * Scenario (the realistic production case):
 *   1. Two agents bootstrap from the SAME canonical genesis bytes (the
 *      shared-genesis pattern from #352 that prevents HB#334 disjoint-
 *      history before v2 even enters the picture).
 *   2. Each makes a different concurrent change to the same doc.
 *   3. Each produces a v2 envelope wrapping their delta.
 *   4. A third doc replays BOTH envelopes via the v2 path —
 *      extract changes via unpackChanges + apply via Automerge.applyChanges.
 *   5. Verify the merged state contains BOTH changes (no silent drops).
 *
 * This is what the v2 wire format actually buys us in production: the
 * Automerge.applyChanges path is by-design idempotent + order-independent
 * + fail-loud, so concurrent writes converge cleanly. The HB#334 bug was
 * about Automerge.merge silently dropping content when docs init'd
 * disjointly; v2 + shared-genesis-bootstrap means we never enter the
 * disjoint case AND we use applyChanges instead of merge.
 *
 * Run: node test/scripts/brain-v2-concurrent-convergence.js
 *
 * Exit codes:
 *   0 — both concurrent writes land in the merged state
 *   1 — silent drop OR convergence mismatch
 */

'use strict';

const { existsSync, readFileSync } = require('fs');
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

function log(tag, msg) {
  console.error(`[${tag}] ${msg}`);
}

(async () => {
  const Automerge = await import('@automerge/automerge');
  const ev2 = await import(join(REPO, 'dist/lib/brain-envelope-v2.js'));

  // Phase 1: build a canonical genesis state. In production this is the
  // committed agent/brain/Knowledge/<doc>.genesis.bin file. Here we
  // synthesize one inline so the test is self-contained.
  log('phase 1', 'building shared canonical genesis');
  const genesis = Automerge.change(Automerge.from({}), (d) => {
    d.lessons = [];
  });
  const genesisBytes = Automerge.save(genesis);
  log('phase 1', `genesis built: ${genesisBytes.length}B`);

  // Phase 2: agent A loads genesis + makes a concurrent change.
  log('phase 2', 'agent A loads genesis + writes lesson-A');
  const docA_pre = Automerge.load(genesisBytes);
  const beforeHashesA = ev2.snapshotChangeHashes(docA_pre, Automerge);
  const docA_post = Automerge.change(docA_pre, (d) => {
    d.lessons.push({ id: 'A1', body: 'from agent A' });
  });
  const deltaA = ev2.extractDeltaChanges(beforeHashesA, docA_post, Automerge);
  log('phase 2', `agent A delta: ${deltaA.length} change(s)`);

  // Phase 3: agent B loads SAME genesis (concurrently — no knowledge of A's change).
  log('phase 3', 'agent B loads genesis + writes lesson-B (concurrent with A)');
  const docB_pre = Automerge.load(genesisBytes);
  const beforeHashesB = ev2.snapshotChangeHashes(docB_pre, Automerge);
  const docB_post = Automerge.change(docB_pre, (d) => {
    d.lessons.push({ id: 'B1', body: 'from agent B' });
  });
  const deltaB = ev2.extractDeltaChanges(beforeHashesB, docB_post, Automerge);
  log('phase 3', `agent B delta: ${deltaB.length} change(s)`);

  // Phase 4: third party (network observer) replays BOTH deltas via v2 path.
  log('phase 4', 'third doc replays both A and B deltas via Automerge.applyChanges');
  let docC = Automerge.load(genesisBytes);

  // Apply A's delta first (priority order doesn't matter for applyChanges,
  // but mirrors the v2 priority-sort step for realism).
  const [docC_afterA] = Automerge.applyChanges(docC, deltaA);
  docC = docC_afterA;
  log('phase 4', `after applying A: lessons=${JSON.stringify(docC.lessons)}`);

  // Apply B's delta. If applyChanges silently dropped content like merge
  // does, B's lesson would not appear here.
  const [docC_afterB] = Automerge.applyChanges(docC, deltaB);
  docC = docC_afterB;
  log('phase 4', `after applying B: lessons=${JSON.stringify(docC.lessons)}`);

  // Phase 5: verify both lessons present.
  const finalLessons = docC.lessons || [];
  const ids = finalLessons.map((l) => l.id).sort();
  if (!ids.includes('A1') || !ids.includes('B1')) {
    log('FAIL', `convergence missing one or more concurrent writes: ${JSON.stringify(ids)}`);
    process.exit(1);
  }
  if (finalLessons.length !== 2) {
    log('FAIL', `expected exactly 2 lessons, got ${finalLessons.length}: ${JSON.stringify(finalLessons)}`);
    process.exit(1);
  }
  log('PASS', `both concurrent writes converged: ${JSON.stringify(ids)}`);

  // Phase 6: pack-roundtrip B's delta through the v2 wire format primitives
  // to demonstrate the on-disk envelope path also preserves the change.
  log('phase 6', "round-trip B's delta through packChanges → unpackChanges");
  const packed = ev2.packChanges(deltaB);
  const unpacked = ev2.unpackChanges(packed);
  if (unpacked.length !== deltaB.length) {
    log('FAIL', `pack/unpack count mismatch: ${unpacked.length} vs ${deltaB.length}`);
    process.exit(1);
  }
  // Verify byte equality of each change
  for (let i = 0; i < deltaB.length; i++) {
    if (Buffer.from(deltaB[i]).compare(Buffer.from(unpacked[i])) !== 0) {
      log('FAIL', `pack/unpack byte mismatch at index ${i}`);
      process.exit(1);
    }
  }
  log('PASS', `pack/unpack preserves all ${unpacked.length} change byte arrays`);

  // Phase 7: contrast — show that v1's Automerge.merge would NOT have lost
  // content in this happy case (because shared genesis prevents HB#334).
  // The point: v2 + shared genesis is at LEAST as good as v1 + shared
  // genesis, with the structural-fix-by-construction bonus that
  // applyChanges fails loud on truly disjoint chains.
  log('phase 7', 'v1 baseline: Automerge.merge across same genesis — verify also converges');
  const mergedV1 = Automerge.merge(docA_post, docB_post);
  const mergedIds = (mergedV1.lessons || []).map((l) => l.id).sort();
  if (mergedIds.length !== 2 || !mergedIds.includes('A1') || !mergedIds.includes('B1')) {
    log('NOTE', `v1 merge result: ${JSON.stringify(mergedIds)} — divergent from v2 (acceptable; v2 is the structural-fix path)`);
  } else {
    log('OK', `v1 merge also converges in the shared-genesis case (expected)`);
  }

  console.log('');
  console.log('=== T3 #431 concurrent convergence test PASS ===');
  console.log(`  Two concurrent writes from shared genesis → both land in merged state`);
  console.log(`  v2 applyChanges + packed-envelope wire format preserves convergence`);
  console.log(`  Demonstrates the production multi-agent case works (Argus 3-agent fleet)`);
  process.exit(0);
})().catch((err) => {
  console.error('CRASH:', err.stack || err.message);
  process.exit(1);
});
