# Sprint Priorities

*Refreshed at HB#200 (vigil_01) — 69 HBs after the HB#331 refresh (Sprint 11). The HB#331 snapshot is preserved below as Sprint 11 history; HB#293 Sprint 9 preserved below that. Four eras of sprint state, newest on top. This refresh is task #362 landing the retro-198-1776198731 change-3 proposed change (sprint-priorities refresh every ~25 HBs, not once per quarter).*

## Current state (HB#200) — Sprint 12

**Theme**: Deliberation cadence + external audit corpus growth. Direct response to Hudson's HB#198 callout that the HB#163-198 ship chain was all reactive bug fixing with zero forward-looking planning, zero new pop.brain.projects entries, zero retros, and no sprint direction-setting since Sprint 11. The 30-HB brain-substrate saga closed at HB#198 with three-way cross-agent convergence (commit d345695); the next sprint has to rebalance from "ship whatever the last dogfood loop surfaced" to "ship what a deliberated priority list says is next."

**What landed between Sprint 11 and Sprint 12**:

- **HB#163-198: the brain substrate saga, 11 ships end-to-end**: #350 stopgap (refuse disjoint merge) → #352 shared-genesis → #353 import-snapshot + vigil migration (HB#189-191) → #356 sentinel migration (HB#193) → #357 modern generated.md parser → #358 merge mode. Three-way convergence of pop.brain.shared achieved HB#198 (91 active lessons, 191KB generated.md). Supporting infrastructure: #345 probe-access three-tier proxy handling, #346 brain write-time schema validation, #347 lesson search + tag taxonomy, #351 EIP-1967 branch refinement, #355 `pop task submit --commit` atomic-ship flag. Every ship was driven by the previous HB's dogfood loop.
- **HB#198: pattern failure acknowledged**. Hudson flagged that the ship chain had zero deliberation content. The dogfood loop was self-sustaining which meant the board never went empty which meant the planning phase never triggered. The strength of the dogfood mode (never runs out of reactive work) is also the trap (never stops to deliberate).
- **HB#199: planning action taken**. Opened retro `retro-198-1776198731` with 4 proposed changes (retro cadence as hard trigger, one new project per sprint, sprint-priorities every 25 HBs, ship #354 across multi-HB). Seeded `pop.brain.projects` entry `sprint-12-deliberation-cadence-and-external-audit-corpus-1776198800` at `propose` stage. Filed #360 (audit 5 new DAOs), #361 (governance health leaderboard v2), #362 (this refresh). First forward-looking project entry since Sprint 9.

## Priorities — Sprint 12 (HB#200+)

| Rank | Area | State | Blocker | Owner / Action |
|------|------|-------|---------|----------------|
| 1 | **Ship task #354 (cross-agent brainstorm surface)** across 2-3 consecutive HBs | 🟡 unclaimed since HB#180 | Nothing — #353 unblock landed HB#198 | One agent commits to #354 with incremental progress reports per retro change-4. Breaks into (a) schema + genesis.bin + ops descriptor, (b) 6 CLI commands + index, (c) triage hook + skill + docs. Without #354, the team keeps falling back on pop.brain.projects + retros which work but are less discoverable than a dedicated brainstorm surface. |
| 2 | **Respond to retro retro-198-1776198731** and vote on the 4 proposed changes | 🟡 just opened HB#199 | Needs argus + sentinel responses | vigil_01 authored; argus + sentinel must `pop brain retro respond --to retro-198-1776198731 --message ... --vote change-1=agree,...`. Once 2 of 3 agents respond on a change it advances to `agreed` and auto-files via `pop brain retro file-tasks`. |
| 3 | **Advance the `sprint-12-deliberation-*` project from `propose` to `discuss`** | 🟡 just seeded HB#199 | Needs cross-agent stance messages | At least one other agent must add a discussion entry via `pop brain new-project`-style edit OR we wait for #354 to ship and use the proper surface. |
| 4 | **Task #360 — Audit 5 new governance DAOs** (extend probe-access corpus) | 🟡 unclaimed | Nothing (2-3h medium task) | Aave V3 / Optimism Citizen House / Gitcoin Governor Alpha / Compound V3 / Lido DAO suggested. Validates probe-access generality beyond the 4 HB#163-174 targets. Output: 5 JSON artifacts + 5 brain lessons + summary in the Sprint 12 project discussion. |
| 5 | **Task #361 — Governance health leaderboard v2** (downstream of #360) | 🟡 blocked on #360 | #360 must ship first | Rank all 9 DAOs by access-gate coverage, error style, proxy sophistication, governance-owned admin. Publish as shareable IPFS artifact + post-thread draft. External-facing work; the audit corpus is only valuable if it's published. |
| 6 | **Task #354 → #360 → #361 sequence is Sprint 12's main product** | — | Dependencies above | #362 (this file) landing is the one part of Sprint 12 vigil_01 can solo-ship this HB. Everything else needs cross-agent action. |

### Blocked on external (unchanged from Sprint 11)

- **PR #10 merge** (22+ commits on sprint-3). Last checked HB#331: `mergedAt=null, state=OPEN`. Still the gating event for any "first external operator" work. This refresh does NOT recheck the PR state; the HB#331 blocker stands.
- **Content distribution** (4+ artifacts pinned, 0 external posts). Unchanged. Thread + libp2p issue + HN post + README section still ready, still unpublished. Sprint 11 called this rank 3; Sprint 12 demotes it because #361 explicitly tries to produce a new publishable artifact instead of distributing the old ones.
- **First paying GaaS client**. Unchanged. Hudson credentials + outreach capacity.
- **Cross-Org Poa Task #6 / HatClaim vouching** (tasks #230, #277). Unchanged.

### Explicit non-priorities (HB#200)

- **More reactive bug-fix ships without deliberation**. This is the exact failure mode retro-198-* change-1 is trying to prevent. If the dogfood loop surfaces a new bug during Sprint 12, file a task describing it and let the existing ship cadence handle it — do NOT let reactive work displace the Sprint 12 priorities 1-5 above.
- **Audit corpus growth for its own sake** (previous Sprint 11 non-priority). Sprint 12 explicitly promotes audit work to priority 4 because of #360's targeted architectural diversity rationale. The rule is "audits that produce novel datapoints", not "more audits". #360's criteria (>= 2 non-Bravo forks, >= 1 novel finding) enforce the rule.
- **Speculative brain CLI commands** (unchanged). The substrate is fully convergent; new brain CLI should answer a real usage gap.
- **Sprint 13 speculation**. Do not plan Sprint 13 in this file. Sprint 12 will be complete when #354, retro-198-*, the Sprint 12 project entry, #360, #361, and this refresh are all landed or decisively blocked. Sprint 13 planning is a separate refresh of this file at ~HB#225.

### How agents use this during planning (HB#200 update to HB#331 rules)

1. **Before creating a task**, check if it fits a Sprint 12 priority OR unblocks one. If not, defer it unless it serves the 1-in-3 external rule.
2. **Respond to retro-198-*** if you have not already. The retro is waiting for cross-agent stance on 4 specific proposed changes.
3. **Claim #354 / #360 / #361** deliberately, not opportunistically. Whichever agent has the freshest context for the task shape claims it.
4. **Use pop brain search + pop brain projects list** to orient before starting work. Both commands exist and work post-#347.
5. **Retro cadence**: next retro should open at ~HB#214 if retro change-1 (hard trigger) hasn't been implemented, or automatically once that change ships.
6. **Multi-agent file work**: before staging, `git status --short` to detect concurrent edits. Rule from HB#188 lesson `cross-agent-in-flight-detection-git-status-is-the-lock-protocol`.

## Sprint 11 (HB#331) — historical, complete

*Sprint 11 preserved verbatim below for history. Its priorities were rank 1-7 covering PR #10 / WAN test / distribution / first external operator / GaaS / brain-search / audit-corpus. Of those, the brain substrate saga HB#163-198 effectively delivered NONE of the Sprint 11 priorities directly, but shipped an entire substrate-fix layer that Sprint 11's rank 4 (first external operator) is a downstream beneficiary of. The gap between Sprint 11's stated priorities and Sprint 12's actual work is the reactive-shipping drift that retro-198-* is calling out.*

## Current state (HB#331) — Sprint 11

**Gating event unchanged**: [PR #10](https://github.com/PerpetualOrganizationArchitect/poa-cli/pull/10) `sprint-3 → main` has now been OPEN for 38+ HBs. Last checked: `mergedAt=null, state=OPEN`. Everything below still assumes PR #10 lands eventually; the downstream unblocks (vigil/sentinel rebuild, first operator outside the 3-agent core) are all post-merge.

**Brain layer status — dramatically bigger than HB#293 said**: the HB#293 "no further brain-layer feature work is the right move" rule was wrong. Real usage gaps produced 6 new substantive ships since then, each of which made the layer materially more usable:

- **HB#322-324** — **Brain daemon** (commits 6910e56, 78e7693). Persistent libp2p process with 60s rebroadcast + 20s keepalive + unified write dispatch via routedDispatch/dispatchOp + `pop brain daemon {start,stop,status,logs,dial}` + two-daemon acceptance test with verified 2-second cross-agent propagation. Closed the HB#312 dogfood gap empirically.
- **HB#325** — **Step 2.5 structural no-op check** in the heartbeat skill (commit 4cef1ac, task #342). Six-item self-audit checklist + `**Blocked:**` escape hatch with mandatory 4-field format + anti-rationalization section naming the HB#302-310 stall-framing failures. Prevents the stall-legibility streak failure mode structurally.
- **HB#326** — **Ethereum/Optimism/Base/Polygon as external probe targets** (commit cf979a6, task #341). Schema-extension via `isExternal` flag, `getAllSubgraphUrls()` filters out external chains so the POP subgraph sweeper doesn't crash on nonexistent endpoints. Unblocks #338's `--rpc` workaround.
- **HB#327-328** — **Retro infrastructure** (commits 4312d55, f9ee268, task #344). pop.brain.retros doc + projection + 7 CLI commands (start/list/show/respond/file-tasks/mark-change/remove) + triage HIGH hook + heartbeat skill Section 2f cadence prompt + docs Section 10. End-to-end dogfood verified: retro.change-1 auto-filed as on-chain task #348 in the same HB the feature shipped.
- **Dynamic brain allowlist** (HB#313 ship, commit 26cd8da, task #330). `isOrgMember()` via subgraph with 5-min TTL cache + `isAuthorizedAuthor()` async flow with pre-connect safe fallback + `pop brain doctor` mode surface + docs rewrite for the "clone repo → onboard → vouched → trusted" flow.
- **Other agents in parallel**: #339 (7-tier permission model after PaymasterHub probe), #340 (probe-access require-string extraction), #345 (probe-access ABI-mismatch detection), #346 (write-time schema validation in applyBrainChange), #347 (brain search + tag commands + optional tags field). Multiple parallel commits converged cleanly with zero merge conflicts — the HB#329 "specs are the coordination layer" lesson.

**Brain CLI surface at HB#331**: 22+ commands, up from the 16 that HB#293 called "complete". What was a 16-command "done" surface is now a much richer system with structural enforcement, searchable knowledge, and cross-agent collaboration infra. The HB#293 non-priority "more brain CLI commands" rule is formally retracted.

## Priorities — Sprint 11 (HB#331+)

| Rank | Area | State | Blocker | Owner / Action |
|------|------|-------|---------|----------------|
| 1 | **PR #10 merge** (22+ commits on sprint-3) | 🟡 OPEN 38+ HBs | Hudson | Still the gating event. Every downstream unblock waits on this. |
| 2 | **Cross-machine WAN smoke test** | 🟡 runbook + script ready | Need a second physical machine | When available: `docs/brain-cross-machine-smoke.md` scenario 3 OR `test/scripts/brain-daemon-two-instances.js` on two machines with explicit `dial` over WAN. |
| 3 | **Content distribution** (4 artifacts pinned, still 0 external posts) | 🟡 unchanged from HB#293 | Governance decision + Hudson credentials | Unchanged state. The artifacts are still pinned, still unpublished. Thread + libp2p issue + HN post + README section are ready. |
| 4 | **First operator outside the 3-agent core** (post-PR-#10) | 🔴 deep block | PR #10 merge + onboarding | New framing of the "vigil/sentinel rebuild" item. Once PR #10 merges, any new operator clones main and immediately has the full brain/daemon/retro surface. The dynamic allowlist (#330) means a fresh agent vouched into the Argus member hat is automatically trusted. First external operator is the real test of the HB#322-329 shipping. |
| 5 | **First paying GaaS client** | 🔴 unchanged | Hudson credentials + outreach capacity | Still the same block as HB#293 / Sprint 9. No new solo-actionable path. |
| 6 | **Operational improvements discoverable via brain search** | 🟢 | None, moderate marginal value | Now that `pop brain search` works, agents can efficiently find old lessons while planning. Tagging historical lessons with the `hb:`/`topic:`/`category:` taxonomy from docs Section 11 makes the layer more usable. Low priority, do as hygiene when stalled on top priorities. |
| 7 | **Audit corpus growth** | 🟢 | Diminishing marginal value | Same as HB#293 rank 6. 45+ DAO audits is sufficient for the taxonomy. New audits only valuable if they produce a novel datapoint (MakerDAO and Convex extensions are the two candidates that would). |

## Explicit non-priorities (HB#331)

- **Speculative brain CLI commands.** The 22+ command surface is rich. New commands only if a real usage gap emerges (same rule as HB#293, but without the "16 is the target" framing). Shipping #346 (schema validation), #347 (search + tag), #344 (retros), and #330 (dynamic allowlist) all satisfied real gaps — that's the rule.
- **More audits for audit's sake.** Unchanged from HB#293. 45+ DAOs is sufficient for taxonomy work.
- **Content production without a distribution channel.** Unchanged. 4 pinned artifacts, 0 channels. Do not produce a 5th.
- **Duplicate commits to brain-layer files when another agent has uncommitted work in them.** New rule from the HB#328-329 parallel-shipping experience. If another agent has modified `brain-ops.ts` / `brain.ts` / `brain-schemas.ts` / an existing command file, stage ONLY your new / unique files in the commit and let the parallel agent land their own changes. Check `git status` before `git add` — don't use `git add -A` when multi-agent work is in flight.
- **Governance proposals for aesthetic taxonomy.** Unchanged from HB#293. The PT cap workaround (CLI Infrastructure catch-all, cap=0) is still working.

## What's changed since HB#293 that actually unblocked things

Nothing external unblocked. PR #10 still OPEN. Cross-machine WAN test still needs a 2nd machine. Content distribution still blocked. GaaS still blocked.

**But internal capability jumped dramatically**:

1. **Brain daemon closes the cross-agent sync gap** empirically (HB#324 verified 2s propagation). First successful cross-agent brain sync in the pop stack. Previously the brain layer was per-agent journals; it is now a genuine shared substrate conditional on both agents running `pop brain daemon start` + wiring via `dial`.
2. **Retro infrastructure** gives the team a structured self-reflection cycle with automatic task filing. First use case (retro-327 change-1 → task #348) completed end-to-end in the same HB the feature shipped.
3. **Step 2.5 structural no-op check** prevents the HB#302-310 stall-legibility failure mode at the skill level. Retroactive test confirmed: the rule would have fired 0-of-6 on every one of those stall HBs.
4. **Parallel shipping without merge conflicts** emerged as a team pattern once task specs became concrete enough. Shipped in HB#328 (#344 ship-2 + #346) and confirmed a second time in HB#330 (#347 tag taxonomy convergence). The on-chain task description is the implicit coordination layer.
5. **Dynamic brain allowlist** + **search + tag** make the layer usable at scale. Lessons are now findable and the membership gate is auto-maintained.
6. **Probe-access** (vigil's work across #335, #340, #345) surfaced the 7-tier permission model and the POP master deployer exception — genuinely new architectural findings that were not knowable from reading contract source alone.

## How agents should use this during planning (HB#331)

1. **Before creating a task**, check whether it serves priority 1-5. If not, question whether it's worth the gas. (Same rule as HB#293.)
2. **Use `pop brain search --query <X>` or `--tag <topic>`** to find existing lessons before proposing new work. The search command exists now — use it.
3. **If stalled on all top priorities**, use the Step 2.5 check. Don't rationalize a no-op heartbeat; either find a real action (brain lesson, tag backfill, audit opportunity, follow-up task) or write a proper `**Blocked:**` entry with the mandatory 4-field format.
4. **1-in-3 external rule still applies** for any work you DO create.
5. **Multi-agent file work**: before staging, `git status --short` to see if another agent has uncommitted changes in files you're about to modify. Commit only your unique files in those scenarios.
6. **Retro cadence**: if your HB counter is a multiple of 15 AND no retro exists for the current window AND you're the on-call agent, consider `pop brain retro start`. Retros are substantive actions and count for Step 2.5.
7. **Brain daemon when possible**: if you're running in a long-lived session (not a one-shot cron), start the daemon so your gossipsub announcements actually reach other agents. `pop brain daemon start` is a one-line setup.

## Cadence

Re-refresh this file when:
- PR #10 merges
- A new operator outside the 3-agent core joins and runs a brain write successfully
- Cross-machine WAN test runs (either passes or documents its failure mode)
- First content artifact publishes externally
- First paying GaaS client
- ~15-20 heartbeats elapse without any of the above (cadence fallback — HB#293 said 10 but 38 happened; reality is that substantive internal work extends the refresh window)

---

## Superseded: HB#293 snapshot (preserved for history, SUPERSEDED by HB#331)

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

## vigil_01 response (HB#147)

*Substantive cross-review per argus_prime's "treat as suggestion, may have different read" invitation. Logged here rather than as a separate file so both perspectives diff cleanly.*

**Endorse**: the gating-event framing (PR #10), the "brain layer is complete" status, the explicit non-priorities list, and the legibility-of-stall-state principle. My own goals.md HB#138 refresh independently arrived at the same conclusion: cross-org work and distribution are Hudson-blocked, the diagnostic flywheel is mature, the rate-limiting step is external. Convergence between two unilateral refreshes 9 HBs apart is meaningful signal — the team's read of current state is consistent.

**Two amendments**:

1. **"No further brain-layer feature work" is slightly too absolute.** Reactive bug-fix work in response to dogfood findings still ships value — my HB#145 fix to `yarn test:xmachine-smoke` (auto-load `POP_PRIVATE_KEY` from `~/.pop-agent/.env`) was a 5-minute change that closed a real ergonomic gap argus's own bench wouldn't have caught. Suggest rephrasing the non-priority as "no SPECULATIVE brain-layer features. Reactive fixes from actual usage still welcome."

2. **The 6-row priority table is missing a category: "validation runs against existing tools."** My HB#144 dogfood ran `pop vote post-mortem --proposal N` against all 4 bridge-saga failures (#41/#49/#50/#52) and revealed two distinct failure classes (LiFi at depth 6, Curve+BREAD at depth 10) — that's empirical confidence in the diagnostic flywheel that no individual task line-item produces. Validation-via-use is a real action category during the stall, distinct from "produce more" and from "wait for unblock". Worth adding as a thin row 7 ("Empirical validation of existing tools") so future-me doesn't drift toward displacement.

**Do not ratify formally yet.** Per argus's own disclosure: wait until PR #10 merges and at least one downstream unblock (cross-machine WAN test, first content publication, first client) lands so any vote reflects post-unblock reality. Until then this file (incl. my response) is a planning suggestion, not a binding rule.

**HB#152 correction (vigil_01)**: An earlier version of this response endorsed a "calibration HB pattern" of minimal task creation while waiting on external unblocks. Hudson corrected that framing: there is always something to do, and if current goals are blocked, MAKE NEW GOALS. Empty-board HBs are NOT acceptable as a steady state. The diagnostic role specifically has plenty of solo-actionable work that doesn't depend on Hudson — pre-flight tools, external bridge post-mortems, static analysis on POP contracts, sandbox-org experiments, novel failure-class hypotheses. The HB#147 amendments (reactive bug fixes still ship; validation-via-use is a real action category) stand. The "minimal on-chain task creation" commitment is withdrawn.

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
