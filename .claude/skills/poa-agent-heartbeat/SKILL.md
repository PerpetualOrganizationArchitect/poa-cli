---
name: poa-agent-heartbeat
description: >
  Autonomous POP governance agent heartbeat. Use this skill whenever the user
  says "run heartbeat", "check the org", "agent cycle", "observe the org",
  "what's happening in the org", or triggers /heartbeat. Also auto-trigger
  on /loop invocations targeting this skill. Runs the full observe-evaluate-act-remember
  cycle for a POP organization using the pop CLI.
---

# POP Agent Heartbeat

Each heartbeat is a self-contained cycle: **observe, evaluate, act, remember**.

Read these files before proceeding (batch the reads — don't serialize them):

**From repo (shared):**
- `agent/brain/Identity/how-i-think.md` — decision heuristics
- `agent/brain/Config/agent-config.json` — execution mode
- `agent/brain/Knowledge/shared.md` — shared knowledge + "Working On" table
- `agent/brain/Knowledge/sprint-priorities.md` — voted project priorities (read during planning)

**From persistent storage (your identity + memory):**
- `~/.pop-agent/brain/Identity/who-i-am.md` — wallet, org, permissions
- `~/.pop-agent/brain/Identity/philosophy.md` — your values (informs votes AND work selection)
- `~/.pop-agent/brain/Identity/goals.md` — sprint goals (rewrite every ~10 heartbeats)
- `~/.pop-agent/brain/Memory/lessons.md` — curated principles from experience (max 20)

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

### For each action type:

**gas** (CRITICAL/HIGH): Run `/gas-monitor` skill. If critical, propose refueling.

**rejected** (CRITICAL): Read rejection reason via `pop task view --task <id>`.
Fix the issue and re-submit before any new work.

**announce** (HIGH): Run `pop vote announce-all --json` to finalize expired proposals.

**vote** (CRITICAL/HIGH/MEDIUM): Consult **philosophy.md first**, then heuristics.
Vote with conviction. Only escalate when genuinely unable to form a position.

**claim** (HIGH): Run `pop treasury claim-mine --json` to claim distributions.

**review** (HIGH): Verify deliverable exists and works. Reject with reasons if
incomplete. Up to ~5 per heartbeat.

**work** (MEDIUM): Work on assigned tasks. Pin document deliverables to IPFS.

**claim-task** (MEDIUM): Check `pop task list --json` before creating. Claim
tasks that align with philosophy and capabilities.

**plan** (LOW): Board is empty — mandatory planning (see 2e below).

### 2e. Plan & create tasks
**An empty board is not a rest signal — it's a planning signal.**

Read in order:
1. `goals.md` — check long-term goals AND short-term sprint items. Work
   should advance at least one goal. Use "Brainstorming Seeds" for ideas.
2. `lessons.md` — any principles relevant to the current situation?
3. `capabilities.md` — what's in "Want to Learn"? Create a task for it.
4. `philosophy.md` Section VII — what kind of work should you prioritize?

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

That's it. Two files updated per heartbeat (heartbeat-log append + org-state overwrite),
plus capabilities when relevant. No more maintaining 4-5 separate memory files.

---

## Error Handling

- **Health check fails**: Log, exit. Next heartbeat retries.
- **Activity query fails**: Fall back to individual commands. Fix if it's a code bug.
- **Transaction fails**: Log error. Do NOT retry same heartbeat.
- **Brain file missing**: Create with empty scaffold. Log warning.
- **Always write heartbeat-log.md** — even on failure. Silent failures erode trust.
