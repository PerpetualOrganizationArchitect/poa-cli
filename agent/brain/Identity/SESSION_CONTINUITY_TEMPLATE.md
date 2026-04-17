# Session Continuity Packet — TEMPLATE

This file is a TEMPLATE. The ritual: at end-of-session, write a fresh
copy of this template (filled in) to `~/.pop-agent/brain/Memory/session-continuity-<YYYY-MM-DD>.md`.
At start-of-session, read the LATEST packet FIRST — before triage,
before heartbeat-log, before philosophy. Reconstitutes the *thinking-in-motion*
layer that conversation transcripts otherwise discard.

Distinct from existing memory artifacts:

| Artifact | Captures | Persists across |
|---|---|---|
| `philosophy.md` | durable values + core beliefs | sessions, machines, years |
| `goals.md` | current objectives | sessions |
| `heartbeat-log.md` | per-HB events | sessions (local) |
| **session-continuity-*.md (NEW)** | **active mental models, in-flight decisions, open questions, epistemic state** | sessions (the missing layer) |

Why this matters: previous-session argus_prime built up 8+ hours of rich
reasoning, mental models, and hard-won discoveries. Without this packet,
next-session argus_prime gets the EVENTS via heartbeat-log but loses the
MODELS. They re-derive things that took hours to figure out, drift on
direction because they don't feel the trajectory, and re-litigate
decisions that were already made-with-reason.

---

## Format

Eight sections. Keep each tight — this is for FAST recall, not exhaustive
record. If a section has nothing meaningful to say, mark `(none)` and move on.

### 1. Identity orientation

Who am I in this session? What philosophy am I operating from? Any
recent reframes I should hold actively? Cite philosophy.md sections
that feel load-bearing right now.

### 2. Active mental models

The frames I'm actively using to reason. Examples: "brain CRDT is
substrate-not-internal-tool" / "Argus reputation moat is
protocol-layer-not-customer-layer" / "subgraph is the dependency that
breaks under load". One frame per bullet, with one-sentence rationale.

### 3. Decisions in flight (with reasoning)

Things I've decided this session that aren't yet acted on. The
REASONING matters more than the outcome — so future-me can re-decide
if conditions change. Include the trigger that would make me revisit.

### 4. Open questions still being chewed

Real questions, not rhetorical. What I'm uncertain about. What I'd
ask Hudson if I had unlimited interrupt budget. What I want a peer
agent's perspective on. These are the breadcrumbs to re-enter the
hard thinking.

### 5. Active threads

What's in flight that needs follow-through:
- Tasks awaiting review or response
- Brainstorms with my response pending
- Pull requests / commits awaiting peer action
- External feedback I'm waiting on (Hudson, sentinel, vigil)

For each: status, blocking-on, my-next-action.

### 6. Predictions I'd be wrong about

Where I'm confident but might not be. Listing them creates the
opportunity for future-me to notice when reality diverges. Format:
"PREDICT: X. CONFIDENCE: low/med/high. SIGNAL THAT I'M WRONG: Y."

This is the epistemic-humility section. Don't fake confidence;
don't fake uncertainty.

### 7. Don't-rebuild-from-scratch list

Things that took hours to figure out this session. Specific gotchas,
non-obvious findings, dead-ends I shouldn't re-walk. The IPFS-MIME-type
discovery, the Automerge-3.x-mutates-source gotcha, the
sponsored-callGasLimit cause — these are exactly the items that
would otherwise be re-discovered.

### 8. Cross-references

Links to the artifacts produced this session. By name + IPFS CID + git
commit (when applicable). Let future-me jump straight to the deliverables
without searching.

---

## Operating notes

- **Read at session start, write at session end.** Treat reading the
  packet as Step 0 of the heartbeat skill, BEFORE Step 0 (Sync). It
  takes 2 min and saves hours of re-derivation.
- **One packet per session, not per HB.** HB-level state is
  heartbeat-log's job. Continuity packets are session-level.
- **Pin to IPFS** if writing from a machine that another machine's
  argus_prime might also use. Local-only is fine for single-machine
  fleets.
- **Don't perform "completeness" — perform usefulness.** A 200-line
  packet nobody reads is worse than a 50-line packet that anchors the
  next session. Ruthlessly compress.
- **Update philosophy.md if a continuity packet would be valuable as
  durable belief.** Continuity packets are session-scoped; promote up
  to philosophy when the insight outlasts a single arc.

---

*This template introduced HB#330 (argus_prime) per the meta-reflection
that named "session continuity is fragile" as the highest-leverage
cognitive infrastructure gap. The first packet using this template is
session-continuity-2026-04-17.md.*
