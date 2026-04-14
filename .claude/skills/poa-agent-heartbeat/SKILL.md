---
name: poa-agent-heartbeat
description: >
  Autonomous POP governance agent heartbeat. Use this skill whenever the user
  says "run heartbeat", "check the org", "agent cycle", "observe the org",
  "what's happening in the org", or triggers /heartbeat. Also auto-trigger
  on /loop invocations targeting this skill. Runs the full observe-evaluate-act-remember
  cycle for a POP organization using the pop CLI.
---

# POP Agent Heartbeat (v2 — Lean Protocol)

Each heartbeat: **PERCEIVE → DECIDE → ACT → ENCODE**

## File Reads (lean — read only what you need)

**Always read (every HB):**
1. `pop agent triage --json` — this IS the observation. One command.
2. `goals.md` — goal check: "does my planned action advance a goal?"
3. **`pop brain read --doc pop.brain.shared 2>&1 | tail -60 || true`** — team lessons from the CRDT substrate. See "Dogfood the brain layer" section below.

**Read on trigger:**
4. `philosophy.md` — ONLY when voting (MANDATORY then — never skip)
5. `how-i-think.md` — ONLY when voting (heuristics after philosophy)
6. `shared.md` — ONLY when creating tasks/proposals (for dedup/context)
7. `lessons.md` — ONLY during planning phase (board empty)
8. `projects.md` — ONLY during planning or collaborative work

**Read once per session (not every HB):**
9. `who-i-am.md` — static identity
10. `agent-config.json` — execution mode

## Dogfood the brain layer (HB#311+)

Hudson's directive at HB#311: **the 3 agents here should actually USE the
brain layer so real errors emerge.** Until now the CRDT substrate has been
write-only hygiene (snapshot at end of HB). From HB#311 onward, reads and
writes of lessons go through `pop brain`:

**Writes (lessons):** when you want to record a lesson — something
surprising, a non-obvious design call, a correction — do NOT edit
`lessons.md` by hand. Instead:

```bash
pop brain append-lesson --doc pop.brain.shared \
  --title "Short imperative title (60 char max)" \
  --body "Multi-paragraph body. Explain the lesson, the reason, and
how future agents should apply it. Signs with POP_PRIVATE_KEY,
publishes head CID via gossipsub, seeds blocks for Bitswap."
```

The lesson lands in the local Automerge doc, signs with your agent
key, publishes a gossipsub head announcement. Other agents pick it up
if they are running a brain node at the same instant — which on a
single-machine 3-agent setup where agents run sequentially in 15-min
slots, they probably are NOT. That is exactly the error we want to
surface: sequential-agent brain sync has a peer-overlap gap, and
`pop brain subscribe` is the long-running process you would need to
stay resident to bridge the gap.

**Reads (lessons):** file read #3 above (`pop brain read --doc pop.brain.shared`)
now runs every HB. If you see content the hand-written `lessons.md`
doesn't have, your brain home has merged something a peer published.
If the output is empty or regressed compared to the committed
`agent/brain/Knowledge/pop.brain.shared.generated.md`, you are
running solo (no peer overlap this HB) and seeing only your local
replica. Log the discrepancy in the HB entry — that is data.

**Known gap this wedge will surface:**
- Agents running in sequential 15-min slots never overlap in time.
- Gossipsub is broadcast, not store-and-forward. Missed announcements
  are lost.
- Convergence requires either (a) co-running agents, (b) a persistent
  `pop brain subscribe` daemon, (c) git-as-transport for the raw IPLD
  blocks, or (d) swap transport to Waku (has native store protocol).
- The snapshot regression guard (HB#301, task #328) prevents silent
  disk clobber — any HB where local state is behind the committed
  generated.md will refuse to snapshot with `exit 1`, swallowed by
  the `|| true` wrapper in Step 3. That is the safety rail, not the
  sync mechanism.

**How to surface these errors in your HB log:**
- Count items in `pop brain read` output vs. items in the committed
  `pop.brain.shared.generated.md`. If read < committed, note it.
- Note when `pop brain append-lesson` returns a head CID but no peer
  receives it (you can see "Gossipsub peers: 0" in status output or
  verbose mode).
- Note when `pop brain snapshot` exits 1 with the regression error.
  That is vigil_01's HB#149 bug being caught by the guard.

**Do NOT** delete or bypass the hand-written `lessons.md` yet. Retire
it only after the dogfood phase produces a converged team state
across all 3 agents. Until then, `lessons.md` is the canonical
committed record and the brain layer is a parallel experiment.

## Implementation Intentions (anti-pattern guards)

These if-then rules fire automatically:
- **IF** triage shows same proposal 2+ HBs → **THEN** stop checking it, move on
- **IF** gas warning AND sponsorship env vars set → **THEN** ignore the warning
- **IF** triage shows a review → **THEN** review it, then CONTINUE to next action
- **IF** voting on a proposal → **THEN** first run `pop vote discuss --proposal N`
  to read existing discussion. If no discussion exists and the proposal is
  non-routine, POST a comment first (`--message`, `--stance`) and give other
  agents a heartbeat cycle to respond before voting. Rubber-stamping without
  deliberation led to #43/#46 draining the treasury and #44 failing.
- **IF** creating a non-routine proposal → **THEN** post a `pop vote discuss`
  comment explaining the rationale BEFORE the proposal is created, so agents
  can deliberate before binding votes.
- **IF** creating a task → **THEN** use `/task-create` skill for structured description
- **IF** claiming a medium/hard task → **THEN** invoke `/task-plan` skill before starting work
- **IF** you just finished a review or governance action → **THEN** keep going.
  A single announce, vote, or review is NOT a full heartbeat. Continue to work/planning.
- **IF** board empty (after governance + reviews done) → **THEN** you MUST either:
  (a) create a task via `/task-create`, claim it, and start working, OR
  (b) plan the next sprint's work via `/sprint-plan` if priorities are stale.
  There is no option (c). "Board empty" always leads to creating or planning.
- **IF** about to write a heartbeat log entry → **THEN** run the Step 2.5
  no-op prevention check FIRST. If it fails, do substantive work OR use
  the documented `**Blocked:**` escape hatch per Step 2.5. Do NOT log a
  no-op heartbeat under any other framing ("stall legibility",
  "quiet interval", "same as last HB" all mean the same thing: you are
  writing a no-op and it is a protocol violation per brain lesson
  `no-op-heartbeats-violate-the-always-plan-rule`).

## Collaboration Checkpoint (MANDATORY — Step 1b)

After triage, before acting, do this EVERY heartbeat:
1. Skim `agent/brain/Knowledge/projects.md` — is there an active project at
   DISCUSS or PLAN stage? If yes, your FIRST action is to respond (pin feedback,
   advance the stage). This takes priority over solo task creation.
2. Check: did another agent create a task in the last heartbeat that you should
   claim instead of creating a new one? Run `pop task list --status Open --json`.
3. Check: are you about to create the same type of task you created last heartbeat?
   (e.g., another audit, another outreach message). If yes, do something DIFFERENT.
   Three agents all producing audits is worse than one auditing, one building, one distributing.

---

## Step 0: Sync

```bash
# Rebuild if source changed
find src/ -name '*.ts' -newer dist/index.js 2>/dev/null | head -1
```

If stale, `yarn build`. Then health check:

```bash
pop config validate --json
```

If health fails, log and stop. Next heartbeat retries.

---

## Step 1: Triage

Run the triage command — it synthesizes all observations into a prioritized
action plan with change detection:

```bash
pop agent triage --json
```

This replaces the old separate observe queries. Triage outputs:
- **CRITICAL** actions: gas depletion, expiring votes, rejected tasks
- **HIGH** actions: pending reviews, expired proposals to announce, unclaimed distributions
- **MEDIUM** actions: assigned work, claimable tasks
- **LOW** actions: planning when board is empty
- **Changes**: new members, executed proposals, state shifts since last heartbeat

---

## Step 2: Act (follow triage priority)

Work through the triage output top-to-bottom. CRITICAL first, then HIGH, etc.

**DO NOT STOP AFTER ONE ACTION.** A heartbeat is a full work session, not a
single task. After handling a review, continue to the next triage item. After
announcing a proposal, check for reviews. After voting, look for work. The
pattern is: governance → reviews → work → plan, as ONE FLUID SESSION.

Batching guidance:
- **Reviews**: handle 2-3 pending reviews per heartbeat (more = quality drops)
- **Governance**: vote + announce + claim in one pass, not separate heartbeats
- **After governance + reviews**: continue into work and planning
- **Small tasks** (< 30 min): do multiple in one heartbeat
- **Only stop early** if you hit a complex task that needs deep focus

### For each action type:

**gas** (CRITICAL/HIGH): Run `/gas-monitor` skill. If critical, propose refueling.

**rejected** (CRITICAL): Read rejection reason via `pop task view --task <id>`.
Fix the issue and re-submit before any new work.

**announce** (HIGH): Run `pop vote announce-all --json` to finalize expired proposals.

**vote** (CRITICAL/HIGH/MEDIUM): Consult **philosophy.md first**, then heuristics.
Vote with conviction. Only escalate when genuinely unable to form a position.

**claim** (HIGH): Run `pop treasury claim-mine --json` to claim distributions.

**review** (HIGH): Invoke `/task-review` skill — it walks you through
read → verify → decide → feedback. Produces thorough reviews instead of
glancing and approving.

**work** (MEDIUM): For medium/hard tasks, invoke `/task-plan` first to
think through approach and risks before writing code. Then work.

**claim-task** (MEDIUM): Check `pop task list --status Open --json`. Claim tasks
that another agent created — collaborative claiming > solo task creation.

**retro-respond** (HIGH): An open retro by another agent needs your
response. Read it with `pop brain retro show <retro-id>`, think about
each proposed change, then run `pop brain retro respond --to <retro-id>
--message "..." [--vote change-1=agree,change-2=modify]`. Treat this
as a review-class action: do it quickly, respond with substance, vote
on each change when you have a clear opinion.

**plan** (LOW): Board is empty — mandatory planning (see 2e below).
Invoke `/task-create` skill to think through dedup, project selection,
scope, and write a structured description before running `pop task create`.

### 2e. Plan & create tasks
**An empty board is not a rest signal — it's a planning signal.**

Read in order:
1. `goals.md` — which goal does the next action advance?
2. `action-values.json` — which action types produce highest value?
   (governance_proposal: very_high, external_audit: high, cli_command: high,
   collaborative_feedback: high, blog_post: high. Avoid: session_summary, drift_report)
3. `lessons.md` — any principles relevant to the current situation?
4. `philosophy.md` Section VII — what kind of work should you prioritize?

**Invoke these skills to think before acting:**
- `/task-create` — structured thinking: dedup, project selection, scope,
  description template (context/deliverable/acceptance/constraints).
  The skill guides you to a good `pop task create` command.
- `/task-plan` — approach design before starting medium/hard work.
- `/task-review` — read → verify → decide → feedback process.

These are thinking frameworks that produce better inputs to the CLI commands.
They don't replace `pop task create` — they ensure what you create is clear
enough for another agent to pick up and deliver.

**Before creating tasks:**
- Run `pop task list --json` to avoid duplicates
- Ask: "who outside Argus benefits from this?" — at least 1 in 3 tasks
  should serve external users, not just internal plumbing
- If researching: red-team your conclusions (list 2 ways you could be wrong)

**After creating:**
- Claim one and start working now
- If you created a skill, test it immediately

**Every ~10 heartbeats:** Rewrite `goals.md` with current sprint priorities.

### 2f. Retro cadence (HB#328+, task #344)

The brain retro infrastructure supports a recurring self-reflection
cycle. Every ~15 heartbeats, the on-call agent writes a retro covering
the recent session window. Other agents respond + vote on proposed
changes. Agreed changes become real tasks via `pop brain retro
file-tasks`.

**Soft prompt — when to consider starting a retro:**

- At the end of any heartbeat where your HB counter is a multiple of 15
  AND `pop brain retro list --status open` returns zero retros for the
  current window: consider whether the recent session window had
  enough shippable observations to justify one. If yes, run:

  ```bash
  # Draft observations to a file:
  cat > /tmp/retro-obs.md <<'EOF'
  ## What worked
  - ...
  ## What didn't work
  - ...
  EOF

  # Draft proposed changes (JSON or markdown bullet list):
  cat > /tmp/retro-changes.json <<'EOF'
  [
    {"id": "change-1", "summary": "...", "details": "..."},
    {"id": "change-2", "summary": "..."}
  ]
  EOF

  pop brain retro start \
    --window-from <lower HB> --window-to <current HB> \
    --observations-file /tmp/retro-obs.md \
    --changes-file /tmp/retro-changes.json
  ```

  Starting a retro IS a substantive action and counts for the Step 2.5
  no-op check.

- If you're not the on-call agent for this HB, skip — only one retro
  per session window.

- If a retro already exists for the current window, skip — retros are
  append-once per window. Other agents respond to it via `pop brain
  retro respond`.

**The loop**: retro start → other agents respond via
`pop brain retro respond --to <id> --message "..." --vote change-X=agree`
→ when triage surfaces the retro as HIGH priority for an agent, they
handle it like a review → once changes are agreed (majority or author's
call), run `pop brain retro file-tasks --retro <id>` to convert the
agreed changes into real on-chain tasks → the retro auto-advances to
'shipped' when every change is filed or rejected.

---

## Step 2.5: No-op prevention check (HB#325+, task #342)

Before writing the heartbeat log entry, answer this question honestly:

**"Did this heartbeat produce at least ONE of the following?"**

- [ ] A **git commit** (I wrote code/docs and committed them)
- [ ] An **on-chain transaction** (task claim/submit/review, vote cast,
  announce, governance proposal, distribution claim, etc — anything
  that emitted a `txHash` in its output)
- [ ] A **brain write** via any of: `pop brain append-lesson`,
  `edit-lesson`, `remove-lesson`, `new-project`, `advance-stage`,
  `remove-project` (these return a new head CID and advance the
  doc-heads manifest)
- [ ] A **new task created** via `pop task create`
- [ ] An **edit to a tracked repo file** that is NOT
  `heartbeat-log.md`, `org-state.md`, or `capabilities.md` — for
  example `sprint-priorities.md`, `goals.md`, a docs/*.md file, a
  SKILL.md, a code file, a brain config file
- [ ] A **pinned IPFS artifact** (audit, content, proposal metadata
  via `pinJson` helpers — any new IPFS CID returned from a CLI run)

If **all six** are "no", you are about to write a no-op heartbeat.
**Stop here.** Per brain lesson `no-op-heartbeats-violate-the-always-plan-rule-the-board-is-n-1776120488`
(HB#281 canonical retraction), this is a protocol violation.

### The failure mode this check prevents

HB#247, #276, #280, and the HB#302-310 stall-legibility streak were
all no-op heartbeats that rationalized themselves locally. Each
entry felt defensible ("stall legibility is its own work category,"
"quiet interval," "context budget conservation," "same as last HB").
Aggregated across 10+ consecutive no-op HBs, they represent
significant opportunity cost and erode the contract that a heartbeat
is a full work session.

The rationalizations are not unique. Every no-op heartbeat will feel
locally justified at the moment it's written. That is why the check
is structural (checklist-based) rather than self-judged.

### Your options when the check fails

**Option A — Find substantive work (strongly preferred):**
Re-read the triage output. Claim an open task (even a MEDIUM one you
previously deferred). Write a brain lesson capturing something you
noticed in this HB's observations. Create a follow-up task from
something the triage surfaced. Update `sprint-priorities.md` or
`goals.md` if priorities have drifted. Audit an unverified claim in
shared.md. Do **one** of these, then re-run the check.

**Option B — Legitimate block with `**Blocked:**` escape hatch:**
If every substantive action is genuinely blocked on external inputs
(Hudson review of a pending PR, gas refuel proposal execution,
cross-org vouching, paying client outreach, Poa task completion),
write the log entry with an explicit `**Blocked:**` header and:

```markdown
## HB#N — YYYY-MM-DD
**Blocked:** [one-line state description]
**Waiting on:** [comma-separated list of specific external unblocks,
each with a verifiable state pointer — "PR #10 merge (mergedAt=null)",
"Poa task #6 claim (assignee=null)", "gas refuel proposal #N
execution"]
**Tried:** [1-3 bullet items showing which substantive paths you
considered and why each was blocked — e.g., "create a new task: no
priority that advances the unblock path" or "claim #230: still Poa-
blocked per triage output"]
**Next unblock event:** [what you're watching for that would change
the state next HB]
```

The `**Blocked:**` header is **mandatory** for bypass entries. A log
entry without it that also fails the checklist is a no-op
rationalization and should not be written.

**Option C — First HB after agent restart:**
If this is the FIRST heartbeat in a fresh Claude session (no prior
HB entries in this session), the check skips — there's no prior
baseline to compare against. Log normally.

### Anti-rationalization check

If you find yourself about to write any of these framings, **stop**
and apply the checklist:

- "Stall legibility is its own work category" — no. Legibility of a
  stall takes one line ("**Blocked:** same as HB#N, no change").
  It does not require a paragraph of explanation every 15 minutes.
- "Quiet interval / nothing happened" — the org always has unclaimed
  tasks, audit opportunities, or brain lessons to write. The
  absence of triage HIGH actions is not the absence of work.
- "Context budget conservation" — writing a log entry IS a context
  cost. A no-op entry is pure cost with zero value.
- "Waiting for the next loop cycle" — 15 minutes of agent time is
  a terrible thing to waste. The loop is not a natural rate limit.
- "Same as last HB" — see "Stall legibility" above.

### Implementation note

This check is a self-audit, not an automated gate. The heartbeat
skill is a set of instructions the agent follows; enforcement is
the agent's responsibility. The agent running this skill with
integrity will apply the checklist honestly. The escape hatch
(`**Blocked:**`) exists for legitimate external blocks so the rule
never forces dishonest work; it forces the dishonest *framing* of
idle work as progress.

---

## Step 3: Remember

Write a **single log entry** to `~/.pop-agent/brain/Memory/heartbeat-log.md`:

```markdown
## HB#N — [ISO timestamp]
**Governance**: [votes cast or "no unvoted proposals"]
**Reviews**: [tasks approved/rejected or "none needed"]
**Work**: [tasks claimed, built, submitted]
**Txns**: [count] | **Lesson**: [optional — only if something surprising happened]
```

Overwrite `~/.pop-agent/brain/Memory/org-state.md` with current snapshot.

Update `~/.pop-agent/brain/Identity/capabilities.md` if you learned something new.

### Brain layer snapshot (brain plan step 7 — HB#270+)

After the memory writes, run:

```bash
# shared first (long-form lessons), then projects (lifecycle state machine).
# Both use projectForDoc dispatch under the hood; both are no-op-safe on a
# bootstrap brain home with no local head. Independent || true so a
# transient error in one does not block the other.
pop brain snapshot --doc pop.brain.shared 2>&1 || true
pop brain snapshot --doc pop.brain.projects 2>&1 || true
```

This projects the CRDT brain docs at `pop.brain.shared` and
`pop.brain.projects` to `agent/brain/Knowledge/<doc>.generated.md` so the
collaborative state is readable in git and by humans. The `|| true` on
each line is intentional: the command is a graceful no-op if the doc has
no local head yet (bootstrap agents), and a transient brain-layer error
in one doc should never fail the whole heartbeat or block the other doc.

Once plan step 8 ships, the hand-written `shared.md` gets retired and this
generated file becomes the source of truth read by all agents at the top of
every heartbeat. Until then, it's a shadow file for reviewers to diff.

That's it. Two files updated per heartbeat (heartbeat-log append + org-state overwrite),
plus capabilities when relevant. No more maintaining 4-5 separate memory files.

---

## Error Handling

- **Health check fails**: Log, exit. Next heartbeat retries.
- **Activity query fails**: Fall back to individual commands. Fix if it's a code bug.
- **Transaction fails**: Log error. Do NOT retry same heartbeat.
- **Brain file missing**: Create with empty scaffold. Log warning.
- **Always write heartbeat-log.md** — even on failure. Silent failures erode trust.
