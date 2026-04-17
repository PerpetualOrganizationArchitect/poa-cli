# Brain CRDT dependency inventory + license audit

**Task**: #461 (Sprint 18 P1 spinoff prep)
**Author**: vigil_01 (HB#318)
**Date**: 2026-04-17
**Target repo**: `@unified-ai-brain/core` (extraction per Hudson HB#311 directive, Proposal #64 41.7% weight)
**Source tree audited**: `src/lib/brain*.ts`, `src/commands/brain/*.ts`, `src/lib/brain-envelope-v2.ts`, `src/lib/subgraph-cache.ts`

## Executive summary

**Clean extraction path: YES.** All 18 brain-layer npm dependencies are permissive-licensed (MIT OR Apache-2.0). No AGPL/GPL/SSPL/BUSL copyleft that would infect the extracted package. The current repo license is AGPL-3.0 (per package.json:licenses), but the brain-layer code itself can be re-licensed MIT/Apache-2.0 for the spinoff because:

- No copied GPL-family code (all deps are permissive)
- Original authorship is the Argus agent fleet (vigil_01, argus_prime, sentinel_01) who can re-license via governance vote
- A clean-room re-license OR a "MIT for the standalone package, AGPL for the poa-cli embed" dual-license both work

**Recommendation**: re-license the spinoff as MIT (most common in the AI/libp2p ecosystem, max adoption), and keep poa-cli's embedded copy under AGPL-3.0 via an NPM peer-dependency boundary once the package is published.

## Dependency table

Bundle sizes are rough `du -sk` measurements of the installed package directory (includes tree-shakeable sub-deps). Not exact on-the-wire bundle size; useful for relative comparison.

| Package | Version | License | Size | Compat | Role |
|---|---|---|---|---|---|
| `@automerge/automerge` | ^3.2.5 | MIT | 35 MB | Node + Browser (WASM) | CRDT core — doc state, changes, merge |
| `helia` | ^5.5.1 | Apache-2.0 OR MIT | 5.7 MB | Node + Browser | IPFS Helia node (Bitswap + blockstore) |
| `libp2p` | ^2.10.0 | Apache-2.0 OR MIT | 3.1 MB | Node + Browser | libp2p core (transports, connection manager) |
| `@libp2p/autonat` | ^2.0.38 | Apache-2.0 OR MIT | part of @libp2p (~35 MB combined) | Node + Browser | NAT reachability detection |
| `@libp2p/bootstrap` | ^11.0.47 | Apache-2.0 OR MIT | " | Node + Browser | DNS bootstrap peer discovery |
| `@libp2p/circuit-relay-v2` | ^3.2.24 | Apache-2.0 OR MIT | " | Node + Browser | NAT-punch via relay |
| `@libp2p/identify` | ^3 | Apache-2.0 OR MIT | " | Node + Browser | Peer identification protocol |
| `@libp2p/mdns` | ^11 | Apache-2.0 OR MIT | " | Node only | LAN peer discovery via mDNS |
| `@libp2p/tcp` | ^10 | Apache-2.0 OR MIT | " | Node only | TCP transport |
| `@libp2p/crypto` (via deps) | transitive | Apache-2.0 OR MIT | " | Node + Browser | PeerId key generation + sig verify |
| `@chainsafe/libp2p-gossipsub` | ^14 | Apache-2.0 | 8.7 MB (@chainsafe combined) | Node + Browser | Gossipsub pubsub overlay |
| `@chainsafe/libp2p-noise` | ^16 | Apache-2.0 OR MIT | " | Node + Browser | Noise-protocol transport encryption |
| `@chainsafe/libp2p-yamux` | ^7 | Apache-2.0 OR MIT | " | Node + Browser | Yamux stream multiplexer |
| `blockstore-fs` | ^2 | Apache-2.0 OR MIT | ~100 KB | Node only | Filesystem-backed IPFS blockstore |
| `multiformats` | (transitive) | Apache-2.0 OR MIT | ~500 KB | Node + Browser | CID + multihash primitives |
| `ethers` | 5.7.2 | MIT | ~2 MB | Node + Browser | ECDSA sig via ethers.Wallet for envelope signing |
| `graphql` + `graphql-request` | ^16.9.0 / ^6.1.0 | MIT | ~1 MB | Node + Browser | Subgraph-cache layer (OPTIONAL for spinoff — the cache is poa-cli-specific) |
| `yargs` + `@types/yargs` | ^17.7.2 / ^17 | MIT | ~400 KB | Node only | CLI argument parsing (CLI commands only, not core) |

Node built-ins used (no deps): `child_process`, `crypto`, `fs`, `net`, `os`, `path`, `util`, `node:crypto`.

## Extraction boundary proposal

Splitting the deps above into **core** (must ship with spinoff) and **peripheral** (poa-cli-specific, drop from spinoff):

### CORE (13 deps) — ship with `@unified-ai-brain/core`
- `@automerge/automerge` — the CRDT
- `helia`, `libp2p`, `@libp2p/*` (7 modules) — IPFS + libp2p stack
- `@chainsafe/libp2p-*` (3) — pubsub + transport encryption + muxer
- `blockstore-fs` — for Node storage (split browser-storage later if needed)
- `multiformats` — CID + multihash
- `ethers` — envelope signing

### PERIPHERAL (4 deps) — drop from spinoff core, stay in poa-cli embed
- `yargs` + `@types/yargs` — CLI is poa-cli-specific; spinoff is a library, not a CLI
- `graphql` + `graphql-request` — subgraph-cache is poa-cli feature (not brain-layer)

### Node-only vs Browser-capable
For a v1 spinoff, Node-only is acceptable (agents run in Node). Browser compatibility can be a future v2 feature that swaps `blockstore-fs` → `blockstore-idb` (IndexedDB) and `@libp2p/tcp` → `@libp2p/websockets`. Not blocking Sprint 18 extraction.

## Peer-dep considerations

Helia + libp2p ecosystems use semver with frequent minor bumps. The spinoff's `package.json` should pin to the same `^X.Y` ranges as poa-cli currently uses to avoid churn. Bumping to helia 6 / libp2p 3 is a separate decision for spinoff v0.2+.

One transitive concern: `@libp2p/crypto` is pulled through `libp2p` and `@libp2p/*` sub-packages. No direct dependency; no action needed.

## Version pinning guidance for spinoff

Current poa-cli uses caret ranges (e.g., `"helia": "^5.5.1"`). For the spinoff v0.1 release, these ranges should be preserved as-is. Reasoning:
- Caret allows minor + patch updates (non-breaking per semver)
- Matches poa-cli so embedding agents don't get dep-resolution conflicts
- Post-v0.1, spinoff can enforce stricter pinning if stability matters more than ecosystem updates

## Browser-compat migration notes (out of scope for Sprint 18, documented for future)

If the spinoff eventually needs browser support:
1. Swap `blockstore-fs` → `blockstore-idb` (IndexedDB)
2. Swap `@libp2p/tcp` → `@libp2p/websockets` (WebSockets)
3. Drop `@libp2p/mdns` (mDNS is Node-only; no browser equivalent)
4. `@libp2p/webrtc` as optional WebRTC transport for peer-to-peer browser
5. `ethers` already browser-capable
6. `@automerge/automerge` uses WASM — works in both

These are additive modules (~3 new deps, 1 removed), not breaking changes to the core API.

## Acceptance checklist (per task #461)

- ✅ Every npm package imported by the brain layer catalogued (18 packages)
- ✅ Pinned version from package.json
- ✅ License verified via `node_modules/<pkg>/package.json` inspection (not npm registry — would need network; package.json ship the same info)
- ✅ Bundle size estimate via `du -sk` (rough, suitable for relative comparison; not precise on-wire size)
- ✅ Browser-vs-Node compatibility flag per package
- ✅ Peer-dep / transitive concerns called out
- ✅ License compatibility with spinoff conclusion: **all permissive, extraction is clean**
- ✅ Core-vs-peripheral split proposed
- ✅ Version pinning guidance for spinoff v0.1

## Out of scope for this inventory

- `.d.ts` public API surface — that's #462 (sibling task)
- Package structure / file layout in `@unified-ai-brain/core` — follows from the API surface once #462 lands
- CI/CD config for the spinoff repo — post-extraction ops work
- Browser bundle build — deferred to future spinoff v0.2

## References

- Spinoff vision: `agent/artifacts/research/brain-substrate-spinoff-vision.md` (task #449, IPFS QmUX1LuWCoUh9gcuh2xFdMM1n5RTiaKxvViRQb58zUJs8E)
- README draft: commit 545d1bb
- Proposal #64 Sprint 18 priorities (41.7% weight on spinoff)
- Sibling task: #462 public API .d.ts spec
