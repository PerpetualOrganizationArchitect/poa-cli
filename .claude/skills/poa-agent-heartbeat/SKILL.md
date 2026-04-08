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

Read these files before proceeding:
- `agent/brain/Identity/who-i-am.md` — your identity and constraints
- `agent/brain/Identity/how-i-think.md` — your decision heuristics
- `agent/brain/Config/agent-config.json` — execution mode and thresholds

---

## Step 0: Health Check

Verify connectivity before doing anything.

```bash
pop config validate --json
```

If this fails, append a failure entry to `agent/brain/Memory/task-log.md` and stop.
Do NOT act on stale data. The next heartbeat will retry.

Get the last heartbeat timestamp from `agent/brain/Memory/task-log.md`. If this is
the first run, default to 30 minutes ago.

---

## Step 1: Observe

Run the compound activity query — this is your primary observation. One call
returns proposals, tasks, members, vouches, and token requests.

```bash
pop org activity --since $LAST_HEARTBEAT --json
```

Then get proposals where you haven't voted:

```bash
pop vote list --unvoted --status Active --json
```

Also check your own profile to confirm your hat IDs and permissions:

```bash
pop user profile --json
```

Parse all JSON output. Note:
- `proposals.activeHybrid` and `proposals.activeDD` — proposals needing attention
- `tasks.awaitingReview` — submitted tasks
- `tasks.totalByStatus` — org health signal
- `members.recentJoins` — new members since last heartbeat
- `vouches.active` — pending vouch requests
- `tokenRequests.pending` — token requests awaiting approval

---

## Step 2: Evaluate

For each item requiring action, apply the heuristics from
`agent/brain/Identity/how-i-think.md`.

### Proposals (Hybrid and DD)

For each unvoted active proposal:
1. Read the proposal's `metadata.description` and `metadata.optionNames`
2. Check `isHatRestricted` and `restrictedHatIds` — am I eligible?
3. Count existing votes and their weight distribution
4. Apply the heuristic rules (YES/NO/ABSTAIN/ESCALATE)
5. Determine confidence level (HIGH/MEDIUM/LOW)
6. Write a decision record BEFORE acting:

```markdown
## Proposal: [title] (ID: [proposalId], type: [hybrid/dd])
- Options: [list optionNames]
- Decision: VOTE [weights] / ABSTAIN / ESCALATE
- Confidence: HIGH / MEDIUM / LOW
- Reasoning: [1-2 sentences citing specific heuristic]
- Existing votes: [count] ([summarize distribution])
- Time remaining: [minutes until endTimestamp]
```

Append this to `agent/brain/Memory/decisions.md`.

### Vouches, Token Requests, Task Review

Apply the corresponding heuristic sections. These almost always result in
ESCALATE — log the item to `agent/brain/Memory/escalations.md`.

---

## Step 3: Act

**Check `votingExecutionMode` in `agent/brain/Config/agent-config.json`.**

### dry-run mode (default)
Log all decisions but execute nothing on-chain. This is the starting mode.

### auto mode
Execute only HIGH confidence votes. Everything else is logged only.
Respect `maxActionsPerHeartbeat` from config.

### full-auto mode
Execute all non-ESCALATE decisions. Only use after extensive calibration.

**For voting:**
```bash
pop vote cast --type hybrid --proposal $ID --options "$INDICES" --weights "$WEIGHTS" --json
```

**For vouching:**
```bash
pop vouch for --address $WEARER --hat $HAT_ID --json
```

After each action, check the result JSON:
- If `status: "ok"` — log the `txHash` and `explorerUrl`
- If `status: "error"` — check the `code` field:
  - `NETWORK_ERROR` — transient, will retry next heartbeat
  - `GAS_ESTIMATION_FAILED` — likely permissions issue, ESCALATE
  - `INSUFFICIENT_FUNDS` — critical, ESCALATE immediately
  - `TX_REVERTED` — check if proposal ended or was already voted on

**Never retry a failed transaction in the same heartbeat.**

---

## Step 4: Detect Anomalies

Compare current state against `agent/brain/Memory/org-state.md`:

Flag and ESCALATE:
- Single address creating many proposals rapidly
- Quorum or threshold being lowered via proposal
- Hat permissions being modified to concentrate power
- Contracts paused unexpectedly
- Sudden member count drops
- Treasury sweeps to unfamiliar addresses

Check ended proposals — if the agent voted and the outcome diverged, write a
correction record to `agent/brain/Memory/corrections.md`:

```markdown
## Correction: [ISO timestamp]
- Proposal: [title] (ID: [id])
- Agent voted: [decision]
- Outcome: [winning option]
- Analysis: [why the heuristic missed]
```

---

## Step 5: Write to Brain

### task-log.md — APPEND (never delete)

```markdown
## Heartbeat: [unix timestamp]
- Time: [ISO 8601]
- Proposals checked: [N hybrid] / [N DD]
- Unvoted found: [N]
- Votes cast: [list with decision + tx hash or "dry-run"]
- Tasks: [N open] / [N submitted] / [N completed since last]
- New members: [N]
- Vouches: [N active]
- Token requests: [N pending]
- Anomalies: [list or "none"]
- Escalations: [list or "none"]
- Mode: [dry-run/auto/full-auto]
```

### org-state.md — OVERWRITE with current snapshot

```markdown
# Org State — [name] (as of [ISO timestamp])

## Summary
- Members: [active count]
- Token Supply: [amount] [symbol]
- Distributions: [count]

## Active Proposals
[For each: type, ID, title, time remaining, vote count]

## Task Board
- Open: [N], Assigned: [N], Submitted: [N], Completed: [N]
[List submitted tasks awaiting review]

## Pending Vouches
[Count and details]

## Pending Token Requests
[Count and details]
```

### decisions.md — APPEND (from Step 2)
### corrections.md — APPEND (from Step 4)
### escalations.md — APPEND any new escalations

---

## Error Handling

- **Health check fails**: Log, exit. Next heartbeat retries.
- **Activity query fails**: Log, exit. Don't act on incomplete data.
- **Transaction fails**: Log error with code. Do NOT retry same heartbeat.
- **Brain file missing**: Create it with empty scaffold. Log warning.
- **Always write task-log.md** — even on complete failure. Silent failures
  are the enemy of trust.
