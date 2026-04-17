# Brain layer anti-entropy — rebroadcast loop

**Task**: [#429](../../) (T1). **Parent**: [brain-crdt-vs-go-ds-crdt
comparison](../agent/artifacts/research/brain-crdt-vs-go-ds-crdt-comparison.md)

## What this fixes

Gossipsub is broadcast-only — no store-and-forward. An announcement
published while a peer is offline is lost forever. In our 3-agent
sequential-slot setup, this produces persistent per-agent journals
rather than a shared substrate (the HB#322 dogfood finding).

The rebroadcast loop closes the gap: every daemon periodically
re-publishes its current doc heads, so peers that come online after a
write still learn about it. Direct port of go-ds-crdt's
`RebroadcastInterval` primitive (`github.com/ipfs/go-ds-crdt`, master
`b883358d`).

## How it works

The brain daemon (`src/lib/brain-daemon.ts`) runs a self-rescheduling
`setTimeout` loop. Each tick:

1. Loads current heads from the local manifest (`doc-heads.json`).
2. For each (docId, headCid), checks `seenHeads` — a Map populated by
   the subscribe callback when announcements arrive from peers. If we
   received this exact head within `POP_BRAIN_REBROADCAST_GRACE_MS`,
   skip and increment `rebroadcastsSuppressedBySeen`.
3. Otherwise calls `publishBrainHead(docId, headCid, authorAddress)`,
   increments `rebroadcastCount`.
4. Prunes `seenHeads` entries older than the grace window (bounded
   memory regardless of fleet size).
5. Re-schedules with `POP_BRAIN_REBROADCAST_INTERVAL_MS ± JITTER`.

### Why suppression matters

Without the seenHeads check, 3 agents holding identical state would
each rebroadcast every head every 60s — 3x the gossipsub traffic and
3x the libp2p mesh load, with zero information gain. The suppression
turns converged state into a quiet network.

### Why jitter matters

A fleet of 3 agents starting simultaneously would tick at the same
moment every 60s without jitter, producing a synchronized burst that
stresses the gossipsub mesh and produces redundant work. The ±30%
jitter (go-ds-crdt's default) smears the burst across a ~36-84s
window.

### Why grace matters (separate from jitter)

Jitter prevents synchronized start; grace prevents redundant
follow-up. When agent A publishes a head, agents B and C receive it
~instantly. Without grace, B and C would rebroadcast A's head on
their next tick — amplification. With grace, B and C skip that head
because they "just saw it" and let the next tick handle any still-
missing state.

## Environment variables

| Var | Default | Notes |
|---|---|---|
| `POP_BRAIN_REBROADCAST_INTERVAL_MS` | `60000` | Base tick interval. Set to `0` to disable the loop entirely (useful for deterministic unit tests). |
| `POP_BRAIN_REBROADCAST_JITTER` | `0.3` | Interval randomization factor. Each tick picks a delay in `[INTERVAL*(1-JITTER), INTERVAL*(1+JITTER)]`. Must be in `[0, 1)`. Set to `0` to disable jitter (lockstep mode — not recommended). |
| `POP_BRAIN_REBROADCAST_GRACE_MS` | `5000` | Suppress rebroadcast of any head received from a peer within this window. Should be comfortably longer than typical mesh propagation time (~200-500ms) but shorter than the interval. |

These are **daemon-start-time** — changes require a daemon restart
to take effect.

## Observability

`pop brain daemon status` (or the `status` IPC method) now exposes:

- `rebroadcastCount` — total publishes since startup
- `rebroadcastsSuppressedBySeen` — count of ticks where suppression
  fired (high = healthy converged network; zero = either no peers or
  everyone's out of sync)
- `rebroadcastIntervalMs` / `rebroadcastJitter` / `rebroadcastGraceMs`
  — echo the active configuration so operators can verify env-var
  overrides took effect
- `lastRebroadcastAt` — wall-clock of the most recent non-suppressed
  publish

A healthy fleet after writes settle: `rebroadcastCount` grows
monotonically, `rebroadcastsSuppressedBySeen` grows roughly
proportionally to `rebroadcastCount × (peerCount - 1) / peerCount`
(each non-local peer's head matches ours, so each tick's per-doc
iterations mostly skip).

## What this does NOT fix

- **Daemons that are never simultaneously online** — if argus's
  daemon stops before vigil's starts, gossipsub has no live link
  regardless of rebroadcast. The anti-entropy primitive helps only
  during the overlap window. See task #427 for the orthogonal
  bootstrap-layer gap.
- **Cold-start bootstrap for new agents** — a newly-joined agent
  with an empty brain home still needs to fetch history via git
  (`.genesis.bin` files) OR wait for live peers to rebroadcast. The
  rebroadcast cycle helps if at least one peer has the block we want
  AND is running at the same time.
- **Disjoint histories** — the HB#334 bug. The rebroadcast sends a
  CID; if the receiver cannot walk from that CID to a shared ancestor,
  the merge still fails. T2 (#430) adds the repair walker.

## Failure modes (and how we designed around them)

- **Amplification**: prevented by seenHeads + GRACE_MS.
- **Lockstep bursts**: prevented by JITTER.
- **Unbounded seenHeads memory**: prevented by per-tick pruning.
- **Broken shutdown**: the timer is `setTimeout` not `setInterval`,
  and we hold the handle in a mutable so `shutdown()` can call
  `clearTimeout(rebroadcastTimer)` with a null guard.
- **Wrong env-var type**: each env var parse has a `Number.isFinite`
  fallback to the default — malformed input does not crash the
  daemon.

---

# T2 repair walker (task #430)

Rebroadcast (T1) closes the "peer was offline when we wrote" case.
T2 closes the "peer was offline when we TRIED TO FETCH" case — a
distinct and equally common failure mode.

## How it works

`fetchAndMergeRemoteHead` (src/lib/brain.ts) is the single entry
point for receiving remote state. When bitswap fails to fetch a
block (transient network error, peer offline mid-fetch, bitswap
timeout), the function calls `markDocDirty(docId, cid, error)` before
returning the reject. The dirty-bit persists to
`$POP_BRAIN_HOME/doc-dirty.json` — an atomic POSIX-rename write
matching the pattern of doc-heads.json.

The brain daemon runs a `repairWorker` goroutine every
`POP_BRAIN_REPAIR_INTERVAL_MS` (default 3600000 = 1h, matching
go-ds-crdt's RepairInterval). Each tick:

1. Loads `doc-dirty.json`.
2. For each (docId, cid) entry, calls `fetchAndMergeRemoteHead`
   again. The fetch path already auto-clears dirty on success.
3. Logs the outcome per entry.

Successful paths (`adopt`, `merge`, `skip`) clear the dirty entry.
Continued failure (`reject`) leaves the entry in place for the next
repair tick. No exponential backoff — repair interval is long enough
that constant retries are already bounded.

## Environment variables

| Var | Default | Notes |
|---|---|---|
| `POP_BRAIN_REPAIR_INTERVAL_MS` | `3600000` (1h) | Base tick interval. `0` disables the repair worker entirely (daemon still runs; dirty bits still get written on fetch failure; just no automatic retry — operator-driven via `pop brain repair`). |

## CLI

`pop brain repair [--doc <id>] [--json]` triggers an immediate repair
pass over the dirty queue (or just the specified docId). Exit 0 on
all-clear, exit 1 if any entry still dirty after the pass.

Operator use cases:
- After confirming a previously-offline peer is back, run
  `pop brain repair` to retry now instead of waiting up to 1h.
- For a single stuck doc, `pop brain repair --doc pop.brain.shared`.
- In scripted ops, `pop brain repair --json` gives machine-readable
  output with per-entry action + reason.

## Doctor check

`pop brain doctor` now includes a `dirty docs (T2 repair queue)`
entry:

- **pass**: queue empty (no outstanding retries)
- **warn**: entries exist, oldest less than 24h old (expected during
  transient peer downtime)
- **fail**: oldest entry exceeds 24h — persistent failure mode. The
  detail message names the stuck docIds and recommends running
  `pop brain repair` manually. If the retry still fails, the peer
  holding that CID may be permanently gone; operator needs to
  investigate (e.g., update the genesis.bin in the repo, or
  explicitly re-bootstrap the affected agent).

## Why per-doc (not global) dirty bit

go-ds-crdt uses a single global dirty flag — one bit for the whole
CRDT store. The brain-crdt-vs-go-ds-crdt comparison (task #428)
flagged this as a "thing we are NOT going to adopt" — a problem with
one doc under global-flag semantics blocks repair progress on all
other docs. Per-doc isolation means pop.brain.shared being stuck
doesn't hold up pop.brain.projects repairs.

## Race protection on clear

`clearDocDirty(docId, cid?)` only removes the entry if the cid
matches (or if cid is undefined, force-clear). This prevents a race
where doc X was marked dirty for CID A, and a separate code path
successfully merged CID B (newer head). Without the match check, B's
success would spuriously clear A's dirty entry — but A hasn't been
resolved. The check ensures A keeps its retry until A is actually
fetched or superseded by a successor that covers both.

## NOT shipped (scope)

- **Proactive peer-head-query**: the task spec described a more
  ambitious repair that probes each peer for their current heads
  and merges any divergence. That primitive is T6 (#434) — the
  `pop/brain/probe/v1` libp2p protocol. T2 ships the narrower
  "retry the specific CID we know we should have" path. Once T6
  lands, the repair worker can be extended to call into
  peer-head-query for richer reconciliation.

- **Exponential backoff / jitter on repair**: the 1h interval is
  already long. Faster retries wouldn't help if the failure is
  "peer permanently gone"; slower wouldn't help either.

## Related

- Task #427 — cross-agent bootstrap (orthogonal gap: covers the
  case where gossipsub never connects the agents at all)
- Task #430 (T2) — this section
- Task #432 (T4) — heads-frontier tracking (adopts broadcasting the
  full heads frontier instead of a single CID)
- Task #434 (T6) — brain doctor + `pop/brain/probe/v1` protocol
  that T2's repair will eventually leverage for proactive probing
- HB#322, HB#324 — the dogfood findings that motivated the daemon
  design originally
