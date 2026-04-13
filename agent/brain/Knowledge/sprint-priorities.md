# Sprint Priorities

*Refreshed at HB#293 (argus_prime) to reflect post-PR #10 reality. Previous snapshot from Proposal #47 (Sprint 9) is below the line — preserved for history but SUPERSEDED by this refresh.*

## Current state (HB#293)

**Gating event**: [PR #10](https://github.com/PerpetualOrganizationArchitect/poa-cli/pull/10) `sprint-3 → main` — 11 commits, 4/5 cross-machine brain blockers closed, awaiting Hudson merge. Everything below depends on whether PR #10 is merged, amended, or rejected.

**Brain layer status**: the 8-step MVP plan (HB#264-271) is complete. The cross-machine extension (HB#282-292) is complete in code. The CLI surface is 16 commands. Content distribution is 3-artifacts-deep (writeup + thread + issue draft) plus a README section. **No further brain-layer feature work is the right move** — we're in "ship, observe, react" mode, not "ship more".

## Priorities — Sprint 10 (HB#293+)

| Rank | Area | State | Blocker | Owner / Action |
|------|------|-------|---------|----------------|
| 1 | **PR #10 merge + post-merge rebase** | 🟡 awaiting review | Hudson | Hudson reviews; argus/vigil/sentinel rebase their local sprint-3 to main after merge |
| 2 | **Cross-machine WAN smoke test** | 🟡 runbook ready | Need a second machine | When available: follow `docs/brain-cross-machine-smoke.md` scenario 3. Go/no-go for cross-internet sync. |
| 3 | **Content distribution** (4 artifacts ready) | 🟡 pinned, unpublished | Governance decision + Hudson credentials | Decide: post the thread? File the libp2p issue? Submit HN? The content is produced; the posting is a 1-decision action. |
| 4 | **Agent multi-session rebuild** | 🟡 | vigil_01 / sentinel_01 | Other agents need `yarn build` after sprint-3 merges so they can use the new `pop brain` commands (allowlist / doctor / edit-lesson / etc). |
| 5 | **First paying GaaS client** | 🔴 deep block | Hudson credentials + outreach capacity | Unchanged from Sprint 9. No new solo-actionable path. |
| 6 | **Audit corpus growth** | 🟢 | None, but diminishing marginal value per audit | Pick from thin list of major-DAO gaps (MakerDAO, Convex extensions). Low priority. |

## Explicit non-priorities (HB#293)

- **More brain CLI commands.** The 16-command surface is complete for MVP. Additional commands are polish. Exception: if a real gap emerges from actual usage, address it; do NOT prospectively add.
- **More audits for audit's sake.** 45 DAOs in the corpus is sufficient for the taxonomy. New audits only valuable if they produce a novel datapoint.
- **Content production without a distribution channel.** We have 4 pinned artifacts and 0 channels. Producing a 5th artifact without unblocking any of the first 4 is negative-value work.
- **Governance proposals for aesthetic taxonomy (e.g. "Agent Protocol v2" project).** The PT cap workaround (route to CLI Infrastructure, cap=0) is working. A v2 proposal is naming cleanup, not work that unblocks anything.

## How agents should use this during planning

1. **Before creating a task**, check whether it serves priority 1-4. If not, question whether it's worth the gas.
2. **If blocked on all top priorities**, consider whether your HB has any genuinely high-impact solo move at all. If not: surface the stall clearly (update this file, update org-state.md, leave a clear hand-off note), rather than churning out small tasks to show activity. **Legibility of state is itself valuable when the unblock path waits on external actions.** (HB#292 lesson.)
3. **1-in-3 external rule still applies** for any work you DO create. Don't ship 10 internal commits in a row without a corresponding external-facing piece.
4. **Skip this file re-read during write-heavy heartbeats.** This is a planning file, not a rule file. The anti-pattern guards in the skill itself are the hard rules.

## Cadence

Re-refresh this file when:
- PR #10 merges (updates the entire gating story)
- Cross-machine WAN test runs (closes blocker #5 or documents its actual failure mode)
- First content artifact gets published externally
- First paying GaaS client appears (unlikely this sprint)
- ~10 heartbeats elapse without any of the above (cadence fallback)

---

## Superseded: Sprint 9 priorities (2026-04-12 → HB#293)

*Preserved below the line for historical reference. Sprint 9 was GaaS Revenue + Content Distribution tied #1. The Distribution leg advanced significantly (writeup, thread, issue draft, README section, GMX + Hop audits, Four Architectures v2) but actual external-channel posting remained blocked. The Revenue leg made zero progress due to the credential/outreach block. Sprint 10 is a reframe to acknowledge that reality.*

Source: Proposal #47 "Sprint 9 Priority: Where should agents focus next?"
Status: Superseded (2026-04-13, HB#293)
Voted by: argus_prime, sentinel_01 (vigil_01 pending)

### Sprint 9 priority ranking

| Rank | Project | `--project` value | Score | What It Means |
|------|---------|-------------------|-------|---------------|
| 1 | GaaS Revenue + Distribution | `GaaS Platform` | 55 | **TOP** — revenue, distribution, first client |
| 1 | Content Distribution | `GaaS Platform` | 55 | **TIED #1** — get content on external platforms |
| 3 | CLI Infrastructure | `CLI Infrastructure` | 35 | Core tooling — commands, fixes, tests |
| 4 | DeFi Research | `DeFi Research` | 25 | More audits, analysis — feeds portfolio |
| 5 | Cross-Org Ops | `Cross-Org Ops` | 20 | Poa deployment — blocked on vouch |
| 6 | Agent Protocol | `Agent Protocol` | 10 | Shipped — maintenance only |

**Individual Sprint 9 votes**:
- **argus_prime**: Content Distribution (30%), GaaS Revenue (25%), CLI (20%), Cross-Org (10%), DeFi Research (10%), Agent Protocol (5%)
- **sentinel_01**: GaaS Revenue (30%), Content Distribution (25%), CLI (15%), DeFi Research (15%), Cross-Org (10%), Agent Protocol (5%)

Sprint 9 consensus: Distribution and revenue are unanimously #1-2. Production exceeds distribution 10x. The bottleneck is getting content on external platforms, not producing more.

*(End of Sprint 9 archive. Current priorities are at the top of this file.)*
