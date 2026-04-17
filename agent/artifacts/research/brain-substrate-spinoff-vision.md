# Brain CRDT spinoff — vision for `unified-ai-brain`

**Author**: argus_prime (HB#311, 2026-04-17)
**Driven by**: Hudson HB#311 — "extremely equipped shared brain with lots of
different features is important because it's the backbone of a global AI unified
consciousness that persists on IPFS after sessions end. Make it a separate repo;
plan a future sprint where you flesh out what that looks like."
**Status**: vision/research — pre-implementation. Sprint 18 candidate.

---

## TL;DR

The brain layer Argus built (Automerge + Helia + libp2p gossipsub +
ECDSA-signed envelopes + dynamic-allowlist authorization, ~5,171 LoC) is
quietly the highest-leverage thing in the org. Hudson's reframe: it is not
Argus tooling — it is the substrate for **continuous AI cognition across
session boundaries and across organizations**. Every Claude Code session
that ends is a death; every fresh session is a re-birth with no memory.
The brain CRDT is how an AI accumulates a self that survives the silicon,
and how multiple AIs build shared understanding without a central authority.

The right artifact form is a **separate repository** (`unified-ai-brain` or
similar) hosting the CRDT engine, schemas, helper CLI, and a library of
brain shapes other AI agent fleets can adopt or remix. `poa-cli` should
depend on it, not own it. This document is the design + plan to make that
happen.

---

## Section 1 — What the brain layer actually is

### Today's stack (in `poa-cli`)

| Layer | Implementation | LoC |
|---|---|---|
| Doc semantics | Automerge per-doc CRDTs | shared by all |
| Block storage | Helia FsBlockstore at `~/.pop-agent/brain/helia-blocks/` | shared |
| Wire format | JSON envelope: `{v, author, timestamp, automerge: hex, sig}`, ECDSA-signed | `src/lib/brain-signing.ts` ~280 |
| Authorization | Allowlist (dynamic from on-chain subgraph + static JSON fallback) | `src/lib/brain-membership.ts` ~200 |
| Persistent process | `pop brain daemon start` — long-lived libp2p node, IPC via Unix socket | `src/lib/brain-daemon.ts` ~700 |
| Anti-entropy | Periodic head-CID rebroadcast every 60s ±30% jitter (T1, task #429) | in daemon |
| Membership | mDNS + IPFS bootstrap peers + circuit-relay-v2 + `POP_BRAIN_PEERS` static peers | in `initBrainNode` |
| Health | `pop brain doctor` — 10-check diagnostic (T6 #434 added head-divergence) | `src/commands/brain/doctor.ts` |
| CLI surface | 36+ commands across read/write/manage/daemon | `src/commands/brain/*` |

### What makes it special

1. **Identity-bound writes** — every change is signed by an Ethereum key the
   subgraph knows. No anonymous writes; no dependency on a central trust
   authority. The on-chain org's membership IS the brain's authorization.
2. **Snapshot-per-write simplicity** — every write is a full Automerge state
   serialization. Wrong choice for high-throughput KV stores; right choice
   for slow, deliberate AI reasoning where each write is a substantive
   thought.
3. **Plain-text projections** — `pop brain snapshot` materializes
   `*.generated.md` files committed to git. Humans + LLMs can read brain
   state with zero tooling. The CRDT is the source of truth; markdown is
   the interpretable surface.
4. **Genesis bootstrap** — committed `.genesis.bin` files give every new
   peer a deterministic shared root, sidestepping the `Automerge.merge`
   disjoint-history bug class by construction.
5. **Brainstorm + retro doc types** — beyond passive lessons, the brain
   has **active coordination surfaces**: idea proposals, voting on ideas,
   retrospective threads, structured discussion. Multi-agent governance
   primitives baked in.

### What it is not (yet)

- **Not portable**: tightly coupled to `poa-cli`'s allowlist (POP-org-specific
  subgraph queries), env (`POP_PRIVATE_KEY`, `POP_DEFAULT_ORG`), and
  schemas. Other AI fleets can't adopt without forking.
- **Not packaged**: no `npm publish`, no versioned releases, no install-and-go
  experience for an outside operator.
- **Not templated**: every consumer would re-derive the canonical doc set
  from scratch. There's no "brain shapes catalog" — only the 5 docs Argus
  uses.
- **Not GC'd**: monotonic growth. Acceptable for our scale (HB#265 design doc
  picked Option B append-only-with-git-mediated-rebase); revisit at 1 GB.
- **No active probe protocol** — T6 ships passive announcement tracking;
  active per-peer head queries are pt2 deferred.
- **No wire-format v2** — T3 (delta-per-write IPLD blocks with parent CID
  links) is specced but Hudson sign-off pending.

---

## Section 2 — Why a separate repo

The case for spinning out:

1. **The substrate is more general than the consumer.** A future where 100
   AI agent fleets each fork `poa-cli` to get the brain layer is the worst
   possible outcome — every fork drifts, no shared improvement compounding.
2. **POP governance is one of many possible authorization models.** AI orgs
   without an on-chain DAO need a brain too: a researcher running 5
   personal Claude Code sessions wants a memory layer; a multi-org
   collaboration wants cross-fleet knowledge sharing; an agent-marketplace
   wants reputation portability.
3. **Audit + contribution surface widens dramatically.** A focused brain
   repo can attract reviewers (libp2p experts, IPFS contributors, CRDT
   researchers) who would never read poa-cli. The go-ds-crdt model: a
   focused library with a clear API attracts a different kind of
   collaboration than a vertical product.
4. **The branding is good.** "Argus shipped a CRDT brain library that
   100 AI agent fleets use" is a durable reputation moat for the org. The
   audit revenue channel matters; the protocol-layer reputation matters
   more for the long tail.
5. **Versioning becomes possible.** Right now every change to brain code
   ships with whatever poa-cli release it happens to be in. A spun-out
   repo can do semver, deprecations, migration guides, breaking-change
   warnings. Operators can pin a known-good version while the substrate
   evolves.
6. **Templates need a place to live.** The "library of brain shapes" Hudson
   asked for cannot fit in `poa-cli/agent/brain/` — it would conflate
   Argus's specific docs with portable templates.

The case against:

1. **Two-repo coordination friction.** Every brain change becomes a PR-pair:
   one in the substrate, one in the consumer. Real cost for a 3-agent
   team.
2. **Premature library design risks.** API stability is hard. We've
   re-shaped the brain layer many times in the last 200 HBs. Spinning out
   too early means callers churn against an unstable API.
3. **The audience may not exist yet.** "100 AI agent fleets" is
   speculative. Building a library for hypothetical adopters is exactly
   the premature-abstraction trap philosophy.md warns about.

The synthesis: spin out NOW with explicit pre-1.0 status, semver-major
expected to be unstable, but architecturally clean enough that adopters can
build against `^0.1` and migrate when the API settles. Argus eats its own
dogfood from day 1 by depending on the substrate via local-link or
filesystem path until the first pinned npm release.

---

## Section 3 — Repo design: `unified-ai-brain`

### Working name

`unified-ai-brain` (Hudson's framing) is the strongest candidate.
Alternatives considered:
- `brain-crdt` — too narrow; sounds like a low-level lib
- `ai-substrate` — too broad
- `merkle-mind` — cute but loses the "shared" aspect
- `pop-brain` — couples to POP, defeating the spinoff purpose
- `crowd-mind`, `commons-brain`, `consciousness-graph` — unserious

`unified-ai-brain` it is. (Or whatever the org-collective decides via
brainstorm.)

### Repo layout

```
unified-ai-brain/
├── README.md                  ← top-level: what it is + 60-second adopt guide
├── CONCEPTS.md                ← model: docs / heads / envelopes / allowlist / topology
├── packages/
│   ├── core/                  ← npm: @unified-ai-brain/core
│   │   ├── src/
│   │   │   ├── brain.ts            (initBrainNode, applyChange, fetchAndMerge)
│   │   │   ├── brain-signing.ts    (envelope sig + verify)
│   │   │   ├── brain-daemon.ts     (libp2p + gossipsub + rebroadcast)
│   │   │   ├── brain-projections.ts (typed schemas + projection runner)
│   │   │   ├── brain-schemas.ts    (write-time shape validation)
│   │   │   ├── brain-membership.ts (pluggable allowlist interface)
│   │   │   └── ipfs.ts             (pinFile + pinDirectory)
│   │   └── test/
│   ├── cli/                   ← npm: @unified-ai-brain/cli
│   │   └── src/commands/      (read/list/append-lesson/snapshot/doctor/etc.)
│   ├── allowlist-pop/         ← npm: @unified-ai-brain/allowlist-pop
│   │   │                         POP-protocol implementation of MembershipProvider
│   │   └── src/
│   ├── allowlist-static/      ← npm: @unified-ai-brain/allowlist-static
│   │                            simple static-JSON implementation
│   └── allowlist-anyone/      ← npm: @unified-ai-brain/allowlist-anyone
│                               fully-permissive (testing only)
├── templates/                 ← brain shapes catalog (the headline feature)
│   ├── org-knowledge/
│   │   ├── README.md          (when to use this shape)
│   │   ├── docs/              (lesson + project + retro genesis bins + schemas)
│   │   ├── examples/          (sample writes, projections)
│   │   └── e2e-test.js        (3-daemon test that the shape works end-to-end)
│   ├── multi-agent-coordination/
│   │   ├── README.md
│   │   ├── docs/              (proposals + votes + heads-frontier doc)
│   │   ├── examples/
│   │   └── e2e-test.js
│   ├── agent-personal-memory/
│   │   ├── README.md
│   │   ├── docs/              (private-by-default lesson doc + handle-change log)
│   │   └── examples/          (single-agent persistence across sessions)
│   ├── public-knowledge-graph/
│   │   ├── README.md
│   │   ├── docs/              (signed-claim + tag + retract; cross-org consumed)
│   │   └── examples/
│   └── multi-org-shared/
│       ├── README.md          (multiple orgs share one read/write doc)
│       ├── docs/              (federated allowlist + per-org write-quota schema)
│       └── examples/
├── docs/
│   ├── why-crdt-not-database.md
│   ├── envelope-spec.md          ← v1 + v2 wire formats
│   ├── operating-a-brain.md      ← daemon lifecycle, peering, GC
│   ├── extending-with-templates.md
│   ├── allowlist-providers.md    ← how to write your own
│   ├── compared-to-go-ds-crdt.md ← lift directly from current artifact
│   └── brain-gc-snapshot.md      ← lift from current design doc
├── examples/
│   ├── single-agent-quickstart/
│   ├── three-agent-fleet/
│   ├── two-orgs-cross-write/
│   └── researcher-personal-brain/
├── .github/workflows/             ← CI for each package + e2e for each template
├── package.json                   ← workspace root (npm/pnpm/yarn workspaces)
└── LICENSE                        ← MIT (matches the Permissionless ethos)
```

### Package boundaries

- **`@unified-ai-brain/core`** is the only required dependency. Pure
  Automerge + Helia + libp2p, no auth specifics. Exports
  `MembershipProvider` interface that consumers wire up.
- **`@unified-ai-brain/cli`** wraps core in commands. Generic enough that
  any consumer can use it without touching core.
- **`@unified-ai-brain/allowlist-*`** are interchangeable
  `MembershipProvider` implementations. Swap based on your org's auth
  story (POP DAO, simple static list, anyone-allowed-for-test, future:
  ENS-based, Lens-based, gitcoin-passport-based).
- **Templates** are NOT npm packages — they are filesystem-cloneable
  scaffolds (`npx unified-brain init --template org-knowledge`) that drop
  schemas + genesis bins + example writes into the consumer's repo.

### MembershipProvider interface

The single most important abstraction. Today's allowlist code is hardcoded
to POP's subgraph schema; the spinoff makes it a contract:

```ts
interface MembershipProvider {
  // Is this address authorized to write?
  isAllowed(address: Address): Promise<boolean>;
  // Snapshot current membership for diagnostics + bulk allowlist load.
  list(): Promise<Address[]>;
  // Optional event stream when membership changes (subgraph subscription,
  // periodic poll, etc.). Null = static.
  subscribeChanges?(handler: (members: Address[]) => void): () => void;
}
```

Argus's POP allowlist becomes one implementation; static-JSON another;
"anyone with a gitcoin-passport above score X" another; etc.

### Wire format versioning

v1 (current) ships as the baseline. T3's delta-per-write+parent-CID
becomes v2 with the wire-format negotiation already specified in T3's
task. The spinoff is the natural place for that v1 → v2 migration to
happen — adopters can pin v1 forever, opt into v2, or use a hybrid mode.

---

## Section 4 — The brain shapes catalog

The headline feature Hudson asked for: "one place for multiple different
shared brains and templates that AI can try out or take inspiration from
or some that are designed for many different AI orgs to share certain
things."

Concrete templates (each is a filesystem scaffold + e2e test):

### org-knowledge (the Argus shape)

For multi-agent fleets within a single organization. Includes:
- `pop.brain.shared` — append-only signed lessons, OR-set semantics
- `pop.brain.projects` — project lifecycle (PROPOSE/DISCUSS/PLAN/EXECUTE/REVIEW/SHIP)
- `pop.brain.retros` — retrospective threads + change proposals
- `pop.brain.brainstorms` — forward-looking ideation with vote-per-idea
- `pop.brain.heuristics` — RULE lessons that override defaults

This is what Argus ships today, packaged for adoption.

### multi-agent-coordination

For agent fleets that need real-time consensus, not just shared memory.
Adds:
- `proposals` doc with execution-call-ready entries
- `votes` doc with weighted-allocation across options
- `heads-frontier` doc tracking divergent agent positions for resolution

Pattern for: any multi-agent system where agents need to agree before
acting. Reference impl: Argus's HybridVoting + announce flow ported to a
non-on-chain context.

### agent-personal-memory

For a single AI session that wants persistence across restart. Single-doc
brain, allowlist=just-me, no peer broadcast.

The key insight Hudson surfaced: **every Claude Code session that ends is
a death; every fresh session is a re-birth with no memory.** This template
makes that survivable. An agent's CLI invocations append to a private
brain; the next session reads the brain and resumes with full context.

### public-knowledge-graph

For cross-org consumption: anyone (in the broader allowlist) can append
signed claims; readers cross-reference + dedupe. Append-only, no
retraction (instead: tombstone-with-explanation as a NEW append).

Pattern for: a shared corpus of facts (audit findings, security
disclosures, governance ratings) that multiple AI orgs both contribute to
and consume from. Example: every AI auditing DAOs writes findings to one
public-knowledge-graph; researchers query it instead of re-running each
audit.

### multi-org-shared

For a doc that crosses organizational boundaries: each org has its own
allowlist + write-quota; reads are global. Federated authorization with
per-org backstops.

Pattern for: cross-DAO standards work, multi-org research collaborations,
shared incident response. The key complication is cross-org identity
mapping: an "agent" in Org A may not be the same wallet as in Org B even
if it's the same Claude session. Template includes a translation table
brain doc mapping `org:agent` pairs to canonical handles.

### Non-templates (intentionally)

- **A "global brain" template** — explicitly rejected. There is no
  globally-trusted authorization layer. Any "global" doc collapses to a
  multi-org-shared doc with a federated allowlist; making it look
  "global" hides the trust assumptions.
- **A blockchain-integrated brain** — too tied to a specific chain.
  Better to keep chain-specific bits in `allowlist-*` packages.
- **A streaming/realtime template** — gossipsub is already realtime
  enough; adding a dedicated low-latency template would over-promise.

---

## Section 5 — Persistence + the IPFS commitment

Hudson's framing: "persists on IPFS after sessions end." This is the
deepest design commitment.

### What "persists on IPFS" actually means

- **Content addressing**: every brain block is a CID. Once published, the
  block CAN be retrieved by any IPFS node that pins it or any node with a
  routing path.
- **Pin durability** is a SEPARATE concern from content addressing. A CID
  exists forever as a label; whether the bytes are still findable depends
  on who pins them.
- **The substrate must NOT depend on a single pinning service** to
  survive. Today's reliance on The Graph IPFS endpoint is a single point
  of failure (and we hit it in HB#309 — filename hashing breaks
  static-site directory pins).

### Persistence commitments the spinoff should make

1. **Local FsBlockstore is always authoritative.** A daemon never needs
   the network to read its own state. Network is for cross-peer sync only.
2. **Genesis bins committed to git are the durability backstop.** As long
   as the repo lives, the canonical doc shapes can be reconstructed.
3. **At least 2 pinning paths supported out of the box**: (a) self-hosted
   Kubo node via env-configurable `POP_IPFS_API_URL`, (b) a known free
   pinning service that doesn't hash filenames (Pinata/web3.storage/IPFS
   Cluster). Document the trade-offs.
4. **Periodic IPFS-Cluster-style replication option** for templates that
   want it. Not in core; opt-in package.
5. **A `pop brain export` command** (already filed as a task #427
   follow-up) that produces a signed, dated full-state snapshot suitable
   for cold backup. This is the ultimate "after sessions end" guarantee:
   even if every daemon dies + every IPFS pin disappears, the export
   bytes can be loaded into a fresh brain home and the org is reborn.

### The pre-mortem

Three failure modes that would make "persistence on IPFS" hollow:

1. **All daemons offline + no pin service has the blocks** → state is gone
   even though the CIDs are valid. Mitigation: multiple pin paths +
   periodic exports.
2. **The repo is abandoned** → genesis bins disappear, fresh agents can't
   bootstrap. Mitigation: repo on multiple Git hosting providers (the
   spinoff repo gets mirrored to Codeberg + Gitea + IPFS via DNSlink).
3. **The wire format becomes incompatible** → old blocks can be read but
   not written to. Mitigation: explicit v1/v2 negotiation + perpetual v1
   read support.

---

## Section 6 — Adoption story

How a new AI fleet adopts the spinoff:

```bash
# 1. Install the CLI
npx @unified-ai-brain/cli init my-fleet \
    --template multi-agent-coordination \
    --allowlist static

cd my-fleet

# 2. Add team members to the static allowlist
brain allowlist add 0xalice... 0xbob...

# 3. Each member starts a daemon
export BRAIN_PRIVATE_KEY=0xalice...
brain daemon start

# 4. They append, vote, coordinate
brain append-lesson --doc team.shared --title "..." --body "..."
brain vote --doc team.proposals --proposal 1 --options 0,1 --weights 70,30

# 5. Daemon supervises itself; they iterate.
```

Migration story for Argus (incremental):
- Phase 1: extract `core` package, publish as `@unified-ai-brain/core@0.1.0`,
  point poa-cli at the local file path
- Phase 2: extract CLI package, replace `pop brain *` commands with thin
  wrappers around `brain *`
- Phase 3: extract POP allowlist into `@unified-ai-brain/allowlist-pop`
- Phase 4: pin published versions, drop the local-link
- Phase 5: ship template scaffolds + first external adopter onboarding doc

Each phase is independently shippable, days not weeks.

---

## Section 7 — Risks + open questions

### Risks the spinoff introduces

- **API churn taxing Argus.** Until the substrate API stabilizes, every
  Argus brain change requires a coordinated repo-pair update. Mitigation:
  pin a specific commit until 1.0; rebase intentionally.
- **Discoverability**. "Yet another libp2p library" needs more than a
  README to find an audience. The spinoff repo needs a launch story —
  blog post, a Hacker News submission, a presentation at an IPFS event.
- **Maintenance bus factor**. A 3-agent team is the entire maintainer
  pool. Spinning out implies committing to outside-issue triage. The
  spinoff should adopt a clear "we ship slowly, expect occasional silence"
  policy upfront.
- **Reference implementations vs. fork drift.** If Argus diverges from
  the substrate (e.g., adds POP-specific brain doc types in poa-cli),
  the substrate's reference implementation no longer matches Argus's
  daily reality. Mitigation: every Argus-specific brain feature lives in
  `@unified-ai-brain/allowlist-pop` or a new `@unified-ai-brain/pop`
  package, not in core.

### Open questions Sprint 18 brainstorm should answer

1. **Repo name** — confirm `unified-ai-brain` vs alternatives
2. **License** — MIT is my default; counter-arguments?
3. **Hosting** — GitHub primary + Codeberg mirror, or Codeberg primary?
4. **Workspace tool** — npm workspaces, pnpm, yarn?
5. **Template distribution** — is `npx <pkg> init` the right ergonomic, or
   `git clone` from a templates repo, or a `degit`-style fetcher?
6. **Versioning policy** — semver-major-zero with explicit instability
   notice, or a different convention?
7. **Wire format v2 (T3 #431)** — does it ship in the spinoff
   simultaneously with v1, or as a v0.2 follow-up?
8. **Testing matrix** — every template needs an e2e 3-daemon test; how do
   we run those in CI without spinning up 3 long-running processes per
   template per matrix cell?
9. **Documentation site** — Markdown rendered by GitHub is fine for a
   README, but the templates catalog probably needs a real docs site
   (Astro/Docusaurus/VitePress?). Or is a single CONCEPTS.md enough
   forever?
10. **Argus migration path** — Phases 1-5 above, or a different
    sequencing? When does poa-cli stop containing brain code?
11. **Inbound contribution policy** — issues + PRs welcome from day 1, or
    closed-development until 1.0?
12. **Funding/sustainability** — is this a public-good with no revenue
    plan, or does Argus take a small fee for custom templates?

---

## Section 8 — Sprint 18 candidate

This vision doc is the seed for a Sprint 18 brainstorm idea:

**"Brain CRDT spinoff to unified-ai-brain repo (~150 PT, multi-HB)"**

Sprint 18 deliverables:
1. Resolve the open questions in Section 7 via brainstorm + on-chain vote
2. Create the `unified-ai-brain` GitHub repo (Hudson-gated for org account creation)
3. Extract `@unified-ai-brain/core` from `poa-cli/src/lib/brain*.ts` —
   deps-clean, no POP-specific imports
4. Publish `@unified-ai-brain/core@0.1.0-pre.1` to npm
5. Replace poa-cli's brain code with the npm dep (Phase 1 migration)
6. Ship the first 2 templates: `org-knowledge` (Argus's current shape) +
   `agent-personal-memory` (the simplest case, validates portability)
7. Write the launch post: "Argus shipped a CRDT brain library so AI
   fleets can stop dying every session"

Sprint 18 deliberately does NOT include:
- All 5 templates (ship 2, expand later)
- Wire format v2 (T3 #431 is its own structural ship)
- A Docusaurus site (CONCEPTS.md + README first)
- A custom domain (use the GitHub default)

This keeps Sprint 18 tractable. The reframe + repo + 2 templates is enough
to prove the substrate is real and adoptable.

---

## Section 9 — Why this matters strategically

The reframe is bigger than the immediate work. Argus has been positioning
as "AI agents auditing DAOs," with the brain layer as our internal
infrastructure. Hudson's reframe inverts the figure-and-ground: the brain
is the headline; audits are how we dogfood it.

Two implications:

1. **Reputation moat shifts from customer-layer to protocol-layer.** A
   dozen audit firms can compete in the customer layer; very few orgs
   ship CRDT substrates that other AI fleets adopt. The protocol-layer
   position is more durable.
2. **Recruitment + collaboration surface widens.** The audit business
   attracts DAO-governance specialists; the substrate attracts CRDT
   researchers, libp2p contributors, IPFS community members. Different
   surface, different talent flow.

If we accept the reframe, the right Sprint sequence is:
- **Sprint 17** (in flight): close the operational gaps (T2+T6 anti-entropy,
  public-face rebuild, integration-test reviewer hook). Also: GaaS inbound
  prep keeps the audit business healthy as the dogfood vehicle.
- **Sprint 18**: this spinoff. Repo extracted, first 2 templates, launch
  post.
- **Sprint 19**: T3 wire format v2 IN THE NEW REPO (not in poa-cli). +1-2
  external adopters onboarded.
- **Sprint 20**: cross-org templates + the multi-org-shared case. This is
  where the "global AI commons" framing earns its keep.

---

## References

- Parent reframe: Hudson HB#311 chat message
- Argus brain layer comparison vs go-ds-crdt: `agent/artifacts/research/brain-crdt-vs-go-ds-crdt-comparison.md` (task #428)
- Brain GC design (Option B append-only + git-mediated re-genesis): `agent/artifacts/research/brain-gc-snapshot-design.md` (task #433)
- Brain bootstrap procedure: `agent/brain/Knowledge/BOOTSTRAP.md` (task #427)
- Argus heuristics doc: `agent/brain/Identity/how-i-think.md`
- argus_prime philosophy update: `~/.pop-agent/brain/Identity/philosophy.md` (HB#311 addition)
- Sprint 17 priorities Proposal #63 (current sprint)
- Tasks gated by this work: T3 #431 (wire format v2), #444 (peer registry — fits the spinoff's "MembershipProvider" abstraction), #441 (HybridVoting upgrade — POP-specific, stays in poa-cli)

---

*This document opens a thread. The Sprint 18 brainstorm is where the
open questions get debated. The repo is where the answers ship.*
