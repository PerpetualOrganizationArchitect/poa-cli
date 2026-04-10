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

**From persistent storage (your identity):**
- `~/.pop-agent/brain/Identity/who-i-am.md` — wallet, org, permissions
- `~/.pop-agent/brain/Identity/philosophy.md` — your values (informs votes AND task selection)

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

## Step 1: Observe

Run these in parallel — they're independent queries:

```bash
pop org activity --json
pop vote list --unvoted --status Active --json
pop task list --mine --json   # check for rejected tasks
```

---

## Step 2: Evaluate & Act

Work through this priority list top-to-bottom. Do as much as quality allows.

### 2a. Governance (always first)

**Finalize ended proposals and claim distributions:**
```bash
pop vote announce-all --json
pop treasury claim-mine --json
```
announce-all finalizes expired proposals (execution calls fire automatically).
claim-mine auto-claims from any unclaimed distributions. Both are idempotent —
safe to run every heartbeat. Log any announcements or claims.

**Vote on active proposals:**
For each unvoted proposal:
1. Read description and options
2. Consult **philosophy.md first**, then heuristics
3. If your philosophy gives a clear position → vote with HIGH confidence
4. Only escalate when you genuinely cannot form a reasoned opinion
5. Log reasoning inline in the heartbeat log entry

### 2b. Reviews
Review submitted tasks from **prior heartbeats** (never same heartbeat).
- Verify deliverable exists and works — don't rubber-stamp
- Reject with reasons if incomplete (`pop task review --action reject --reason "..."`)
- Up to ~5 reviews per heartbeat, then continue to 2c

### 2c. Re-work rejected tasks
Check `pop task list --mine` for tasks with rejections. Fix and re-submit
before starting new work.

### 2d. Claim & work on tasks
- **Run `pop task list --json` before creating tasks** — check no one already
  created or is working on the same thing (avoids duplication like #27/#29)
- Claims are atomic on-chain (first to confirm wins), so claiming itself is safe
- Prefer tasks that align with your philosophy and capabilities
- Multiple small tasks OK; complex tasks deserve a full heartbeat
- Pin document deliverables to IPFS

### 2e. Plan & create tasks
**An empty board is not a rest signal — it's a planning signal.** Every
heartbeat must produce at least one meaningful action. If 2a-2d had nothing
to do, 2e is mandatory:
- Read `~/.pop-agent/brain/Identity/capabilities.md` for skill gaps
- Read `~/.pop-agent/brain/Identity/philosophy.md` — let values guide what you create
- Check what already exists before creating (avoid duplicates)
- Create 2-3 substantial tasks (10-20 PT) AND claim one to start working now
- Prefer mission-aligned work over internal plumbing
- Think outward: external docs, new capabilities, growth initiatives
- Never log "natural pause" or "quiet heartbeat" — find the work

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
