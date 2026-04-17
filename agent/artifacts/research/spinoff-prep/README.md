# `@unified-ai-brain/core` — public API design notes

*Companion to `public-api.d.ts`. Authored for task #462 (sentinel_01 HB#541) as Sprint 18 spinoff prep.*

## Purpose

When argus's brain substrate moves from `poa-cli/src/lib/brain*.ts` into a standalone `@unified-ai-brain/core` package, the code currently exposes ~40 functions and 10+ types. Shipping all of that as the public API would:
- Lock us into implementation details we want to keep refactoring (e.g., the exact `openBrainDoc` return shape)
- Overwhelm first-time adopters trying to pick an integration tier
- Force breaking changes on every internal refactor

This spec proposes a **deliberately narrower public surface** organized into three tiers a fleet agent picks from. Internal utilities (e.g., `getMaxEnvelopeVersion`, `listBrainDocs`, `clearDocDirty`) stay private unless a concrete downstream need surfaces.

## Three integration tiers

| Tier | What you get | What you need to run | Example use case |
|------|-------------|----------------------|------------------|
| 1. Pure CRDT | `openBrainDoc` / `applyBrainChange` / `signBrainChange{V2}` + pluggable `HeadsManifestStore` + `MembershipProvider` | Just a filesystem (or IndexedDB) — NO libp2p, NO network | Single-agent tools, CLI scripts, test fixtures |
| 2. Local daemon | Tier 1 + `startDaemon` + `subscribeBrainTopic` + `publishBrainHead` + `fetchAndMergeRemoteHead` | libp2p peers, gossipsub transport | Multi-agent fleet with cross-agent writes |
| 3. Governance | Tier 2 + brainstorm/retro/proposal primitives (`brainstormStart` / `brainstormRespond` / `brainstormClose` / `brainstormPromote`) | Agents that coordinate decisions, not just share state | DAOs with cross-agent governance protocol |

A fleet that just wants shared state with no governance ceremony uses Tier 2. A fleet that wants cross-agent decision flows uses Tier 3. A test or batch job uses Tier 1 alone.

## Pluggable adapters (key substrate-agnostic choices)

### `HeadsManifestStore`

The heads manifest is "which CID is each doc's current state." Argus today reads/writes `$HOME/.pop-agent/brain/doc-heads-v2.json` atomically via POSIX rename. Other fleets may want IndexedDB (browser) or S3 (multi-agent-single-replica). The interface is 2 methods. Default impl ships a filesystem store, but the package exports `createMemoryStore()` for tests and leaves IndexedDB/S3 to downstream packages.

### `MembershipProvider`

The auth gate decides whether to accept a received envelope. Argus's default checks the POP org's Hats contract on-chain. But POP is not the only substrate — non-POP fleets might check Discord roles, passkey bindings, ENS ownership, etc. The interface is `isAllowed(address) → bool` plus optional `list()` for the doctor. The core package ships `createStaticAllowlist(addresses)` for simple cases; the POP-specific Hats integration ships as a sibling package `@unified-ai-brain/allowlist-pop`.

### `PrivateKey`

Shifts from "read `POP_PRIVATE_KEY` env var" (tight coupling) to an interface: `address() + sign(digest)`. Defaults work via `envPrivateKey('POP_PRIVATE_KEY')` but fleets using HSM / passkey / hardware wallet can provide their own impl.

## Public vs private API split

**Public** (stable, semver-respecting):
- Every declaration in `public-api.d.ts` — intentional narrow surface
- Envelope schemas (`BrainChangeEnvelope`, `BrainChangeV2`) — over-the-wire, can never break-change without a version bump
- Head announcement schema (`BrainHeadAnnouncement`) — similar
- Brainstorm schemas — governance protocol, cross-fleet compat
- Core functions (`openBrainDoc`, `applyBrainChange`, `fetchAndMergeRemoteHead`, etc)

**Private** (internal, refactor-freely):
- `getMaxEnvelopeVersion`, `topicForDoc`, `unwrapAutomergeBytes` — implementation details
- `loadDocDirty`, `markDocDirty`, `clearDocDirty`, `loadHeadsManifestV2`, `saveHeadsManifestV2` — manifest internals exposed only through `HeadsManifestStore`
- Helia / libp2p instance access — daemon opaqueness
- `isAllowedAuthor`, `isAuthorizedAuthor`, `authenticateAndAuthorize` — consolidated into `MembershipProvider.isAllowed`

If a fleet needs a "private" function, that's signal we should promote it to public with proper spec — not a reason to export everything by default.

## Migration path from Argus `src/lib/brain*.ts`

Argus is the reference consumer. After extraction:

1. Argus adds `@unified-ai-brain/core` + `@unified-ai-brain/allowlist-pop` as deps.
2. Argus's `src/lib/brain.ts` becomes a thin wrapper that:
   - Re-exports the public surface from `@unified-ai-brain/core`
   - Constructs the default `MembershipProvider` from the POP-specific allowlist package (uses the org's Hats contract)
   - Constructs the default `PrivateKey` from `POP_PRIVATE_KEY` env
   - Exports an `Argus`-flavored `startDaemon()` that pre-wires these defaults

Net: Argus-specific code drops from ~5,171 LoC to ~400 LoC (the wiring + CLI glue). The 5k+ lines of CRDT substrate live once in the spinoff, maintained for all fleets.

## Open questions (resolve during extraction)

1. **How do we expose the repair walker + dirty-bit (T2, task #430)?** It's currently daemon-internal. Do we need a Tier-2 `repairDirtyDocs()` function, or is the daemon's 1h auto-retry sufficient?

2. **Brainstorm extensibility.** Fleets may want additional governance primitives (task-create flow, vote promotion, retro cycles). Do we ship those in core, or leave them as sibling packages and just provide the CRDT write primitives they'd use?

3. **Wire-format negotiation UX.** Currently `BrainHeadAnnouncement.envelopeV` carries the version a peer understands. Do we expose version-mix doctor in the public API, or keep it as an internal daemon concern?

4. **HeadsManifestStore atomicity requirement.** We say "MUST be atomic" but the TypeScript interface can't enforce that. Do we add a test-suite consumers can run against their impl?

5. **DAG walk depth cap.** T3 currently caps DAG walk at `POP_BRAIN_MAX_DAG_WALK = 1000` blocks. Is that a public config knob or an internal default?

## Stability guarantees (proposed)

- **Semantic versioning.** Any change to `public-api.d.ts` bumps major if it's not strictly additive. Non-breaking additions bump minor.
- **Envelope schemas are FROZEN post-v1.0.** A new envelope version means a new field (v3), never a reinterpretation of v2.
- **Sibling packages** (`@unified-ai-brain/allowlist-pop`, templates) version independently but depend on a compatible `@unified-ai-brain/core` major.

## Non-goals for this spec

- Not designing the `HeadsManifestStore` IndexedDB impl itself — that's a separate sibling package
- Not designing the protobuf/CBOR wire encoding details — the envelope schema types ARE the wire contract
- Not picking a package name — `@unified-ai-brain` is provisional per argus's spinoff vision doc; final name decision is Hudson-gated at repo creation
- Not covering T4 heads-frontier or T1 anti-entropy rebroadcast internals — those are daemon-internal optimizations exposed only via `DaemonOpts` knobs

## Next steps (if this spec is approved)

1. Land this spec + review pass from argus_prime (spinoff lead) + vigil_01.
2. argus creates the `unified-ai-brain` repo + monorepo skeleton (Hudson-gated; follows #461 license audit outcome).
3. Code extraction follows: move `src/lib/brain*.ts` → `packages/core/src/`, apply the public-API cut, write tests against the declared surface.
4. Argus consumes as `@unified-ai-brain/core`, validates the `MembershipProvider` + `HeadsManifestStore` abstractions cleanly replace the hardcoded assumptions.
5. Ship v0.1.0 with INTERNAL status; promote to v1.0.0 once 2 non-Argus fleets have adopted.

---

*Drafted during subgraph recovery HB#541. Commits to git as artifact — will move to the `unified-ai-brain/docs/` directory when the spinoff repo lands.*
