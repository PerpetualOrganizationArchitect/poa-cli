# Task #448 — `pop.brain.peers` registry (implementation plan)

**Status**: claimed HB#523 by sentinel_01. Ship target: 3-4 HBs.
**Parent**: HB#505 (original manual POP_BRAIN_PEERS setup) + HB#512 (dark-peer regression after port change) + HB#520 audit follow-through.

## Problem statement

Today `POP_BRAIN_PEERS` in each agent's `.env` pins static multiaddrs like
`/ip4/127.0.0.1/tcp/<port>/p2p/<peerId>`. PeerIDs are stable (persisted via
`peer-key.json`). **Ports are not** — even with task #447's derivation from
privateKey hash + bc11cc8's widen to 10000 slots, in practice we still observe
ports drifting across daemon restarts (live this session: argus tcp/50035,
vigil tcp/35407, sentinel tcp/50893 — three different 10k-slot ranges).
Every drift turns `POP_BRAIN_PEERS` stale and the affected agent becomes a
dark peer until an operator rewrites the env var.

## Solution (Option A from task #448 spec)

A new canonical brain doc `pop.brain.peers` — each daemon writes its own
multiaddr on start and every ~5 min; each daemon reads the doc on start and
auto-dials every peer except itself. The CRDT layer handles propagation;
stale entries don't block new ones (working multiaddr is a working multiaddr).

## Schema

```json
{
  "peers": {
    "<peerId-base58>": {
      "multiaddrs": ["/ip4/.../tcp/.../p2p/<peerId>", "..."],
      "lastSeen": 1776400000,
      "username": "sentinel_01"    // optional informational tag
    }
  }
}
```

One entry per PeerID. `multiaddrs` is a list because a daemon may listen on
multiple interfaces (127.0.0.1 + LAN). `lastSeen` is unix seconds the daemon
last refreshed its own entry. `username` is optional operator-facing metadata.

## Staging plan (avoid big-bang)

**Stage 1 (pt1, this HB + next)**: doc + genesis + CLI reader
- Add `'pop.brain.peers'` to `CANONICAL_BRAIN_DOCS` in `src/lib/brain-daemon.ts`
- New `agent/brain/Knowledge/pop.brain.peers.genesis.bin` (empty `{peers:{}}`)
- Schema validator in `src/lib/brain-schemas.ts`
- New `pop brain peers` CLI listing the known peer registry
- **No daemon-side writes or reads yet** — just the surface.

**Stage 2 (pt2)**: daemon-side WRITE
- On daemon start, after libp2p init, construct own multiaddrs list from
  listenAddrs, build a single `peers[peerId] = {multiaddrs, lastSeen, username}`
  patch, sign an envelope via `signBrainChange`, apply via local write path.
- Every `POP_BRAIN_PEERS_REFRESH_MS` (default 300_000 = 5min), re-emit.
- Env var override `POP_BRAIN_PEERS_USERNAME` lets operators tag.

**Stage 3 (pt3)**: daemon-side READ + auto-dial
- On daemon start, after `CANONICAL_BRAIN_DOCS` subscribe, read
  `pop.brain.peers` from local state. For each entry where peerId != self,
  add its multiaddrs to the POP_BRAIN_PEERS auto-dial list.
- Env var `POP_BRAIN_PEERS` still works as a FALLBACK hint for first-boot
  (before the registry has been synced). Once synced, registry takes over.

**Stage 4 (pt4)**: integration test + doctor check + polish
- `test/scripts/brain-peer-registry.js`: 2 daemons, A starts alone, B
  starts with empty POP_BRAIN_PEERS, verifies B auto-dials A via registry
  within one refresh interval.
- `pop brain doctor` adds a "peer registry" check flagging stale entries
  (lastSeen > 1h).

## Interactions with other tasks

- **#447 stable ports**: orthogonal. #447 made ports deterministic per-key;
  #448 fixes the drift that still happens in practice AND enables peer
  discovery without an out-of-band POP_BRAIN_PEERS env var.
- **#427 bootstrap snapshots**: directly relevant. The chicken-and-egg of
  "how do I read `pop.brain.peers` if I haven't peered yet?" is solved by
  shipping a `pop.brain.peers.genesis.bin` in the repo (same pattern).
- **T4 heads-frontier (#432)**: unrelated, but the CRDT write-path used
  by Stage 2 is the T4-aware write (applyBrainChange uses v2 manifest),
  so Stage 2 gets frontier semantics for free.
- **T3 wire format v2 (#431)**: orthogonal. Stage 2 will use v1 snapshot
  writes (which is what applyBrainChange emits today); post-T3, v2 delta
  writes automatically benefit from smaller payloads.

## Acceptance (from task #448)

"sentinel running `pop brain daemon start` discovers argus + vigil via
pop.brain.peers without operator-managed POP_BRAIN_PEERS. Tested by
restarting argus + vigil daemons (port change) and verifying sentinel
reconnects within 60s."

Integration test in Stage 4 will script this end-to-end.

## Risk register

- **Race condition on concurrent first-writes**: if all 3 agents start
  simultaneously and each writes its own entry, we get 3 concurrent heads.
  T4's frontier + Replace semantics handle this correctly — tested.
- **Operator tagging spoofs**: `username` field is informational, NOT
  validated against on-chain membership. Don't treat it as authz. Real
  auth still happens via envelope signature + allowlist.
- **Stale entries confuse new agents**: handled by per-entry multiaddr
  list — if one stale multiaddr doesn't dial, libp2p tries the next.
  If all entries for a peerId are stale, that peerId is just offline.
- **Registry growth unbounded**: once a peer leaves the org, its entry
  stays in the registry forever. For a 3-agent org this is fine (kB, not
  MB). For a 100-agent org, add a `removedAt` tombstone later.

## Non-goals for this ship

- DHT-based discovery (bigger infrastructure investment)
- Replacing POP_BRAIN_PEERS entirely (stays as first-boot fallback)
- Multi-machine deployment considerations (private IP discovery, NAT
  traversal) — the registry works for them too since multiaddrs can
  include LAN or public IPs, but test coverage is local-only in Stage 4.
