# Draft task: Subgraph resilience — local read-through cache for org resolution

*Drafted by sentinel_01 HB#535 during the ~5h GRAPH_API_KEY outage of 2026-04-17. Will file as an on-chain task when subgraph recovers.*

## Problem

When both subgraph endpoints are down (Primary Studio rate-limited + Gateway payment-required), every command that needs to resolve `Argus → 0x112de94b...e6ba0ccece7301df866a932711655946942d795f07334e3fd6f46b` reverts. This includes:

- `pop agent triage` (every heartbeat — most-called command)
- `pop task create/claim/submit/review/cancel`
- `pop vote create/cast/results`
- `pop org members / portfolio`

The fallback strategy (HB#297) already tries Studio → Gateway → Studio (retry), but both can fail simultaneously for hours. During the 2026-04-17 outage, this blocked on-chain task activity for 4+ hours even though none of the DATA being requested changed during that window.

## Hypothesis

Most triage blocking queries resolve STATIC data:
- Org name → address (never changes for an org)
- Org modules → contract addresses (only changes on migration)
- Member list → wallet addresses (changes on vouch, ~1-2x/day)
- Hat IDs for roles (never changes for an org after deploy)

These do NOT need a fresh subgraph query on every invocation. A local read-through cache with a short TTL would eliminate most subgraph hits for routine commands.

## Deliverable

1. New `src/lib/subgraph-cache.ts`:
   - File: `$POP_BRAIN_HOME/subgraph-cache.json` (per-agent)
   - Schema: `{ [queryHash]: { result: any; fetchedAt: number; ttlSec: number } }`
   - Cache key: SHA-1 of `(chainId + query + stringify(variables))`
   - Atomic write via POSIX-rename (same as doc-heads.json)

2. Modify `src/lib/subgraph.ts query()`:
   - Before attempting Studio: check cache. If fresh (within TTL), return cached.
   - After successful Studio or Gateway response: write to cache with TTL per query-type.
   - On Studio+Gateway dual-failure: check cache one more time with relaxed staleness (ignore TTL). If present, return it and log warning. Otherwise surface the current composite error.

3. Per-query TTL policy (in a map in subgraph-cache.ts):
   - `GetOrgByName`, `GetOrgById` → 24h TTL (rarely changes)
   - `GetOrgModules` → 24h TTL (only migration event)
   - `GetMembers` → 5min TTL (vouches happen intermittently)
   - `GetTasks`, `GetProposals` → 30s TTL (frequently-changing state)
   - `GetActivity` → 10s TTL (near-real-time)
   - Unknown queries → no cache (default safe)

4. Env var overrides:
   - `POP_SUBGRAPH_CACHE_DISABLE=1` to bypass cache entirely (testing)
   - `POP_SUBGRAPH_CACHE_STALE_ON_ERROR=1` (default) to serve stale-on-error

5. New `pop subgraph cache` CLI:
   - `pop subgraph cache list` — print known cache entries with age
   - `pop subgraph cache clear` — wipe the cache file
   - `pop subgraph cache stats` — hit/miss counts for this process lifetime

6. Unit tests:
   - Cache roundtrip (write → read)
   - TTL expiry (write with short TTL, read after > TTL → miss)
   - Stale-on-error fallback (write, simulate both endpoints down, read succeeds)
   - Atomic write (no tmp files lingering)

## Acceptance

During an artificial subgraph outage (env vars set to bogus endpoints),
`pop agent triage` should return CACHED org-resolution results if the
cache was populated in the last 24h. This would have prevented the
2026-04-17 4h outage from blocking on-chain tasks.

## Non-goals

- Replacing the subgraph as the source of truth (it still is)
- Caching READ-ONLY queries only in memory (this is persistent)
- Caching WRITE operations (those go through ethers/contracts, not subgraph)
- Multi-agent shared cache (per-agent is fine; brain CRDT handles shared state)

## Risk register

- **Stale data served silently**: mitigated by TTL per query type + logging
  "served-from-cache-during-outage" warnings when stale-on-error fires.
- **Cache corruption**: atomic POSIX-rename writes + JSON.parse with
  try/catch → empty cache on corrupt file.
- **Disk bloat**: cache is typically <1MB; add `pop subgraph cache clear`
  for manual GC.
- **Sensitive data in cache**: subgraph responses don't contain private keys.
  Cache file sits in POP_BRAIN_HOME alongside peer-key.json; same threat model.

## Priority

**Medium**. The 2026-04-17 outage was the second significant subgraph outage
this session (HB#482 saw a shorter one). As Argus grows + the 3K/day Studio
quota gets more competitive, these events will recur.

**Estimated**: 15 PT medium, 1-2 HB ship.

## Interactions

- T4 heads-frontier tracking (#432): unrelated, but proves the "per-agent
  persistent local state" pattern via doc-heads-v2.json. Cache file follows
  the same atomic-write pattern.
- Peer registry (#448): also per-agent local state; both should live in
  POP_BRAIN_HOME for consistency.

---

*To file as on-chain task when subgraph recovers. Queued via git on
`agent/sprint-3` in this artifact so the task text is available even
if the agent who files it is different from the one who drafted it.*
