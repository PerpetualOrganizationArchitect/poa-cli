# T4 Heads-Frontier Tracking — Implementation Plan

**Task**: #432 (25 PT, medium, ~8h)
**Parent**: `agent/artifacts/research/brain-crdt-vs-go-ds-crdt-comparison.md` (task #428)
**Owner**: sentinel_01, claimed HB#510
**Status**: Plan only (no code yet). Ship target: 2-3 HBs.

## Problem (restated)

`doc-heads.json` today is `Record<string, string>` — **one** CID per doc. On
concurrent writes from multiple agents, `fetchAndMergeRemoteHead` does
`Automerge.merge(local, remote) → save()` producing a new single head. This
**collapses** the frontier. T1 (anti-entropy rebroadcast) can only announce
that one CID per doc, even when the DAG has multiple concurrent heads in
flight on the network.

Reference behavior: `go-ds-crdt/heads.go` keeps a **set** of known-head CIDs
and broadcasts the whole frontier. Peers pick up any CID in the frontier they
don't already have. Heads collapse naturally when later writes supersede
earlier ones.

## Deliverable scope (from task #432)

1. Schema: `doc-heads.json {docId: cid}` → `doc-heads-v2.json {docId: cid[]}`, atomic rename
2. `fetchAndMergeRemoteHead`: Replace semantics (oldHead → newHead when merging); Add otherwise
3. `publishBrainHead`: broadcast entire head set (`BrainHeadAnnouncement.cids: string[]`)
4. T1 rebroadcast: full frontier per tick
5. `seenHeads`: generalize to per-cid tracking
6. `pop brain heads --doc <id>`: print local frontier CIDs + heights

## Staging plan (avoid big-bang)

**Stage 1 (pt1, this HB+next)**: schema + migration, no semantic change.
- Add `loadHeadsManifestV2(): Record<string, string[]>` that reads v2 if present,
  falls back to v1 and single-elem-wraps. Always returns v2 shape.
- Add `saveHeadsManifestV2(Record<string, string[]>)`. Always writes v2 format
  (`doc-heads-v2.json`). Also writes **v1 `doc-heads.json`** with the highest-CID-per-doc
  during Stage 1 for back-compat with unchanged callsites.
- No behavior change: Stage 1 always keeps a single-element array per doc.
- Tests: migration (v1 file on disk → v2 call returns wrapped), round-trip, atomicity.

**Stage 2 (pt2)**: Replace semantics in `fetchAndMergeRemoteHead`.
- On successful merge, the old head's parents are removed from the set and
  the new head is added. Requires knowing the parent CIDs per envelope —
  today our envelopes don't include explicit parent links (that's T3's job).
  **Workaround for T4-without-T3**: we can still track the frontier, we just
  can't automatically collapse it. When two heads coexist, leave both until
  a later envelope builds on one of them.
- Schema-level: `doc-heads-v2.json` can now hold multi-element arrays per doc.
- Callsites of the old `loadHeadsManifest(): Record<string,string>` migrate
  to v2. v1 API deprecated but not removed.

**Stage 3 (pt3)**: broadcast + T1 rebroadcast + seenHeads + CLI.
- Change `BrainHeadAnnouncement.cid: string` → `cids: string[]`.
- Receivers handle both shapes for one release cycle (read `cids` if present,
  else single-elem-wrap `cid`). This keeps compat with unpatched peers.
- T1's rebroadcast tick iterates the frontier per doc.
- `seenHeads` keyed per-cid (already is per HB#498 commit — just a semantics
  update from "dedupe rebroadcasts of the single head" to "dedupe per-cid
  rebroadcasts in the frontier").
- New `pop brain heads --doc <id>` command.

## Interactions with other tasks

- **T3 (#431, wire format v2, 50 PT hard, Hudson sign-off)**: parent CID
  links would make Stage 2's Replace semantics trivial. Without T3, we
  accept "frontier grows until a structural write rewrites it." T4 is
  deliverable without T3, just imperfect.
- **T1 (#429, rebroadcast)**: already shipped. T4 Stage 3 extends T1's
  rebroadcast to broadcast the whole frontier.
- **T2 (#430, DAG repair)**: already shipped. The repair walker iterates
  `doc-dirty.json` (per-doc), not heads. Unaffected by frontier changes.
- **T6 (#434, head-divergence doctor)**: already shipped. Doctor's "peer heads
  divergence" check would need update to compare frontier sets instead of
  single-cid pairs. Separate follow-up task after T4 Stage 3 lands.

## Risk & mitigation

- **Callsite sprawl**: 8 touches of `loadHeadsManifest` in brain.ts. Mitigation:
  the v1 API stays working via a small shim that returns the first element
  of each v2 array. Gradual migration.
- **Peer incompatibility**: un-patched peers receiving `cids: string[]` payloads.
  Mitigation: Stage 3 handles both shapes for one release; announce the schema
  bump in a brain lesson; declare cutover in ~10 HBs.
- **CRDT semantics**: can two peers ever end up with **different** frontier sets
  that merge-commute to the same final state? Yes — that's fine. The point
  isn't matching sets; it's that eventually each peer receives every ancestor
  CID it was missing. Staleness bounds under T1 rebroadcast interval.

## Acceptance (from task #432)

3-agent concurrent-write test: all three disconnected, write a lesson each,
reconnect, verify within one rebroadcast interval that all three see all three
lessons and converge on a final head set. I'll write this as
`test/scripts/brain-frontier-convergence.js`, modeled on `brain-anti-entropy-rebroadcast.js`.

## First concrete edit target (next HB)

`src/lib/brain.ts:540-629` — add V2 helpers alongside existing v1, no behavior change yet. Small, reviewable, testable.
