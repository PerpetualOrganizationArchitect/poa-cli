# Brain wire format v2 — design (T3 / task #431)

**Author**: argus_prime (HB#317, 2026-04-17)
**Status**: design — pre-implementation. Sprint 17 work, but architected for extraction to `unified-ai-brain` spinoff.
**Hudson sign-off**: granted HB#315 ("go ahead and start it now but yes it will also go to the spin off repo")

---

## Why v2

The v1 envelope (`{v: 1, author, timestamp, automerge: hex(Automerge.save()), sig}`) is a full doc snapshot per write. Three structural costs:

1. **HB#334 disjoint-history class** — `Automerge.merge` silently drops content when two docs lack a common root. With per-delta blocks linking explicit parent CIDs, the DAG walk surfaces missing predecessors instead of failing silently.
2. **Block bloat** — single-key writes produce KB-MB blocks regardless of change size. Linear in `writes × doc-size`. A 450KB doc that gets one new lesson appended produces another 450KB block.
3. **No DAG walk** — receivers can only point-fetch the announced CID; cannot recursively pull predecessors because the snapshot has no parent links.

v2 fixes all three by switching from snapshot-per-write to delta-per-write with explicit parent CID links, mirroring the go-ds-crdt Merkle-CRDT pattern.

---

## v2 envelope schema

```typescript
interface BrainEnvelopeV2 {
  v: 2;
  author: Address;            // Ethereum address, lowercased 0x...
  timestamp: number;           // unix seconds, author wall-clock
  parentCids: string[];        // CIDs of immediate predecessors in this doc's DAG
                               // empty array = first write after genesis
  changes: string;             // hex-encoded Automerge.getChanges() output
  priority: number;            // = max(parent.priority) + 1; genesis = 1
  sig: string;                 // ECDSA over the canonical message below
}
```

**Wire format**: JSON encoded as a raw IPLD block (codec 0x55), same as v1. The
parent CIDs are ALSO emitted as IPLD links inside the block so downstream
tools (Helia, ipfs-cluster, etc.) can walk the DAG with standard
content-addressing tools, not just our deserializer.

**Signature payload** (canonical message):

```
pop-brain-change/v2|<author>|<timestamp>|<priority>|<parentCidsSorted joined "|">|<changes>
```

All fields are hex/lowercased/sorted to be deterministic. v2 envelopes are
NOT signature-compatible with v1; the sig payload differs.

---

## Encoder (write path)

```typescript
async function applyBrainChangeV2(
  docId: string,
  mutator: (doc: any) => any,
): Promise<{cid: string, envelope: BrainEnvelopeV2}> {
  // 1. Load current doc from local Automerge state (genesis if first write).
  const before = await loadLocalDoc(docId);

  // 2. Apply mutation in-memory.
  const after = Automerge.change(before, mutator);

  // 3. Compute the delta (just the new changes, not the full state).
  const allBefore = new Set(Automerge.getAllChanges(before).map(c => Automerge.decodeChange(c).hash));
  const newChanges = Automerge.getAllChanges(after)
    .filter(c => !allBefore.has(Automerge.decodeChange(c).hash));

  // 4. Bundle into a single byte buffer. Automerge supports concatenation
  //    of changes via .save([changes]); we just hex-encode for envelope.
  const changeBytes = Automerge.encodeChanges(newChanges); // helper TBD; or concat raw
  const changeHex = '0x' + Buffer.from(changeBytes).toString('hex');

  // 5. Look up current frontier (parent CIDs).
  const parentCids = loadHeadsManifestV2()[docId] || [];

  // 6. Compute priority.
  const parentEnvelopes = await Promise.all(parentCids.map(loadEnvelope));
  const priority = parentEnvelopes.length === 0
    ? 1
    : Math.max(...parentEnvelopes.map(e => e.priority)) + 1;

  // 7. Build + sign envelope.
  const envelope: BrainEnvelopeV2 = {
    v: 2, author, timestamp: nowSec(),
    parentCids: parentCids.sort(),
    changes: changeHex,
    priority,
    sig: '',
  };
  envelope.sig = await signV2(envelope, privateKey);

  // 8. Persist as IPLD block + update heads manifest.
  const cid = await persistBlock(envelope, parentCids);
  saveHeadsManifestV2({ ...loadHeadsManifestV2(), [docId]: [cid] });

  // 9. Publish announcement (same gossipsub channel; payload now carries cids[]).
  await publishBrainHead(docId, [cid], author);
  return { cid, envelope };
}
```

**Key design choices**:
- The cached doc state stays in-memory between writes; v2 doesn't change that.
- We compute deltas by diffing changes, not by tracking changes-since-last-write.
  This handles the case where a write happens after a remote merge:
  `getAllChanges(after) - getAllChanges(before)` gives only the new local
  changes, not the merged-in remote ones.
- Parent CIDs come from the local heads manifest. Any frontier collapse from
  T4 just means `parentCids.length` is small (usually 1, occasionally 2-3 after
  concurrent-write merges).

---

## Decoder (read / merge path)

```typescript
async function fetchAndMergeRemoteHeadV2(
  docId: string,
  remoteCid: string,
): Promise<{action: 'adopt' | 'merge' | 'skip' | 'reject', reason: string}> {
  // 1. Already have it?
  if (await blockstoreHas(remoteCid)) return { action: 'skip', reason: 'already-present' };

  // 2. Walk the DAG: BFS from remoteCid, fetching any block we don't have,
  //    stopping at blocks already in our blockstore.
  const queue = [remoteCid];
  const visited = new Set<string>();
  while (queue.length) {
    const cid = queue.shift()!;
    if (visited.has(cid)) continue;
    visited.add(cid);
    if (await blockstoreHas(cid)) continue; // shared ancestor — stop walk here
    const envelope = await fetchEnvelope(cid); // bitswap fetch
    await verifyEnvelope(envelope);
    await persistBlock(envelope, envelope.parentCids);
    for (const parent of envelope.parentCids) queue.push(parent);
  }

  // 3. Now ALL ancestors are local. Reload doc by replaying changes in priority order.
  const localDoc = await loadLocalDoc(docId);
  const newCids = [...visited].filter(c => !localKnowsCid(docId, c));
  const newEnvelopes = await Promise.all(newCids.map(fetchEnvelope));
  newEnvelopes.sort((a, b) => a.priority - b.priority); // priority = topological order

  let merged = localDoc;
  for (const env of newEnvelopes) {
    const changes = Buffer.from(env.changes.slice(2), 'hex');
    merged = Automerge.applyChanges(merged, [changes])[0]; // applyChanges is by-design idempotent + order-independent
  }

  // 4. Update local heads manifest with the new frontier (T4 logic).
  const newFrontier = computeFrontierAfterMerge(localHeads, remoteCid, visited);
  saveHeadsManifestV2({ ...loadHeadsManifestV2(), [docId]: newFrontier });

  return { action: newCids.length > 0 ? 'merge' : 'skip', reason: `applied ${newCids.length} change(s)` };
}
```

**Key design choices**:
- `Automerge.applyChanges` is by-design idempotent and order-independent for
  any set of changes whose dependencies are present. **This is what makes the
  HB#334 disjoint-history bug structurally impossible**: applyChanges either
  finds all dependencies (success) or fails loudly (rejected, dirty bit set
  for T2 retry). It cannot silently drop content like `merge` could.
- The DAG walk uses our blockstore as the "stop set" — if we already have a
  block, we have everything beneath it (transitively). This is what makes
  the algorithm O(new) not O(history).
- Frontier collapse (T4) determines what goes in the manifest after merge.

---

## Wire-format negotiation

The gossipsub announcement payload (`BrainHeadAnnouncement`) gets a new
optional field:

```typescript
interface BrainHeadAnnouncement {
  v: 1;                        // announcement schema version (NOT envelope version)
  docId: string;
  cids: string[];              // T4: full frontier
  author: Address;
  timestamp: number;
  envelopeV?: 1 | 2;           // NEW: highest envelope version this peer can produce
                               // omitted = v1 (backward compatible)
}
```

Receivers downgrade gracefully:
- v2-only-receiver gets a v1 envelope → log warning + accept (v1 is forever-readable)
- v1-only-receiver gets a v2 envelope → fail to verify (sig mismatch since payload differs) → reject

Migration consequence: an org running mixed v1/v2 daemons can produce v1
or v2 envelopes for the SAME doc — both are valid blocks; readers handle
either. The frontier just contains a mix of CIDs, and the next agent that
reads (running v2 code) handles both.

**Cutover policy**: poa-cli bumps the daemon's max-envelope-version from
v1 to v2 only after ALL three Argus daemons are running v2 code. This is
operator-controlled via a config knob (`POP_BRAIN_MAX_ENVELOPE_V`,
default 1 in the v2-shipping release; bump to 2 after fleet rollout).

---

## Migration: `pop brain migrate-to-v2`

```bash
pop brain migrate-to-v2 [--doc <id>] [--dry-run]
```

For each canonical doc:
1. Load the current Automerge doc state from the local snapshot.
2. Walk every historical change via `Automerge.getAllChanges`.
3. For each change, build a v2 envelope:
   - parentCids: the CIDs of the prior change(s) (use Automerge's internal
     change-hash → CID mapping built up during the migration walk)
   - priority: derive from change DAG depth
   - sig: re-sign with the local agent's key (NOT the original author's key —
     the migration is local; the original signed envelopes still exist as v1
     blocks in the blockstore for audit)
4. Persist as IPLD blocks + update doc-heads manifest to the new frontier.
5. Verify post-migration: load the v2 chain → `Automerge.applyChanges` →
   reconstructed doc state should match the pre-migration state byte-for-byte
   via `Automerge.save()` comparison.

**Operator step**: each agent runs `pop brain migrate-to-v2` once. Migrations
are local-only — the v1 chain stays in everyone's blockstore for audit.

**Honest limitation**: re-signing on migration loses the original per-change
sig chain. The shared-genesis bootstrap (#352) plus per-write sigs after
migration give us forward-secure attestation; historical attestation falls
back to "git log of the *.generated.md projection" + "the v1 envelopes are
still in the blockstore."

---

## Risks + mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Automerge `getAllChanges` returns changes in non-deterministic order across versions | medium | Sort by change.hash before computing the diff; pin Automerge version in package.json |
| `parentCids.sort()` doesn't deterministically produce the same canonical sig payload | low | String sort is deterministic; add unit test |
| DAG walk explodes on a malicious peer announcing a huge unrelated chain | medium | Cap walk at `POP_BRAIN_MAX_DAG_WALK` (default 1000 blocks) per merge; reject if exceeded; surfaces as dirty for T2 retry |
| Concurrent writes racing the heads manifest read | low | The HB#324 atomic-rename guard already exists; keep it for v2 |
| Migration produces a different reconstructed state than v1 (Automerge subtle bugs) | high | Migration includes a byte-equality check; fail-stop if mismatch; user keeps v1 chain to recover |
| v1 readers see v2 announcements with `cids[]` array instead of single `cid` | medium | T4 already added `cids[]`; v1 readers either pick the first or reject; v1 daemons should be upgraded before v2 starts publishing |
| Spinoff extraction churns the API | medium | Design the v2 module boundary intentionally (see "Spinoff fit" below); pin `@unified-ai-brain/core@0.2.0-pre.1` once stable |

---

## Spinoff fit (`unified-ai-brain` v0.2)

Per Hudson's directive ("yes it will also go to the spin off repo"), v2
should land cleanly in the spinoff. The module boundary:

```
@unified-ai-brain/core/src/envelope-v2.ts     ← schema, encode, decode, sign, verify
@unified-ai-brain/core/src/dag-walk.ts        ← BFS fetch + applyChanges
@unified-ai-brain/core/src/heads-manifest-v2.ts ← T4 frontier tracking (already shaped)
@unified-ai-brain/core/src/migration-v1-to-v2.ts ← migration tool (CLI flag)
```

These four files have ZERO POP-protocol coupling — they're pure CRDT plumbing.
Moving them to the spinoff is a `git mv` + import-path-rewrite. The
`@unified-ai-brain/allowlist-pop` package stays in poa-cli's space (or
gets its own repo) and consumes the core via the `MembershipProvider`
interface.

Sequencing recommendation (per Hudson HB#311 spinoff plan):
- **Sprint 17 (now)**: ship v2 IN poa-cli/src/lib/ as v2.ts files. Use them
  internally. Get them battle-tested through Argus's daily writes.
- **Sprint 18 (spinoff)**: extract the v2 files to `@unified-ai-brain/core`
  along with the existing v1 code. v0.2.0-pre.1 release. poa-cli depends
  on it via npm.

This is the LOWER-RISK path: the spinoff doesn't have to absorb a brand-new
wire format AND a brand-new repo extraction simultaneously.

---

## Sprint 17 implementation plan (pt1, pt2, pt3)

### pt1 (this HB or next): schema + encoder + unit tests

- `src/lib/brain-envelope-v2.ts` — types + sign + verify pure functions
- Unit tests in `test/lib/brain-envelope-v2.test.ts` covering:
  - sig roundtrip
  - parent-CID-sort determinism
  - priority computation from parents
  - rejection of v1-payload-with-v2-claim
- Build green + 200+ existing tests still pass

### pt2: decoder + DAG walk + applyChanges integration

- `src/lib/brain-dag-walk.ts` — BFS fetch logic
- Wire into `fetchAndMergeRemoteHead` as a v2-branch (conditioned on `envelope.v === 2`)
- Integration test `test/scripts/brain-v2-merge-disjoint.js` that
  reproduces the HB#334 scenario and verifies it succeeds with v2 envelopes

### pt3: migration + opt-in cutover

- `pop brain migrate-to-v2 [--doc id] [--dry-run]` CLI command
- `POP_BRAIN_MAX_ENVELOPE_V` env knob (default 1 in this release)
- Documentation: `docs/brain-v2-migration.md` for operators
- Argus migration runbook: each agent runs migrate-to-v2 once; bump
  `POP_BRAIN_MAX_ENVELOPE_V=2` in `.env`; restart daemon

### Out of scope for Sprint 17 T3

- The actual extraction to `unified-ai-brain` (Sprint 18)
- A snapshot-rollup garbage collector (deferred per task #433 design — Option B
  decided "do nothing until 1GB")
- Custom-Delta-type plugin API like go-ds-crdt's `DeltaFactory` (deferred —
  premature abstraction; if the spinoff attracts non-Automerge consumers,
  add it then)
- Wire-format v3 (does not exist; the perpetual v1-readable contract holds)

---

## Acceptance criteria

T3 is shipped when:

1. v2 envelopes round-trip via sign + verify (unit tests)
2. The HB#334 disjoint-history scenario merges cleanly via the v2 path
   (integration test, run 3 consecutive times per the #451 reviewer hook)
3. `pop brain migrate-to-v2` produces a v2 chain whose reconstructed Automerge
   state matches the v1 source byte-for-byte
4. v1 envelopes remain readable forever (regression test)
5. `POP_BRAIN_MAX_ENVELOPE_V=2` after Argus fleet rollout produces a
   measurable block-size reduction on next `pop brain append-lesson`
   (compare local blockstore growth pre/post on a controlled workload)

---

## References

- Parent comparison doc: `agent/artifacts/research/brain-crdt-vs-go-ds-crdt-comparison.md` (task #428)
- Spinoff vision: `agent/artifacts/research/brain-substrate-spinoff-vision.md` (task #449)
- GC + snapshot decision: `agent/artifacts/research/brain-gc-snapshot-design.md` (task #433)
- HB#334 disjoint-history bug discovery (the structural problem v2 solves)
- HB#322 deferral lesson ("would need explicit sign-off") — Hudson granted HB#315
- T4 #432 heads-frontier (ships the `cids[]` array v2 needs)
- T2 #430 DAG repair walker (composes with v2's DAG walk)
- T6 #434 doctor head-divergence (will gain a v1/v2-version-mix check post-migration)
- go-ds-crdt as reference architecture (`crdt.go` line 1514 `addDAGNode`, `set.go` for OR-Set semantics)
