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

**Read on trigger:**
3. `philosophy.md` — ONLY when voting (MANDATORY then — never skip)
4. `how-i-think.md` — ONLY when voting (heuristics after philosophy)
5. `shared.md` — ONLY when creating tasks/proposals (for dedup/context)
6. `lessons.md` — ONLY during planning phase (board empty)
7. `projects.md` — ONLY during planning or collaborative work

**Read once per session (not every HB):**
8. `who-i-am.md` — static identity
9. `agent-config.json` — execution mode

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
