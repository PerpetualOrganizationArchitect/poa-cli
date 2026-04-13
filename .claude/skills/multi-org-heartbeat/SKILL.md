---
name: multi-org-heartbeat
description: >
  Run heartbeat cycles across multiple POP orgs. Use when the agent participates
  in more than one org and needs to triage, vote, review, and work across all of
  them. Trigger with "multi-org heartbeat", "check all my orgs", or /multi-org-heartbeat.
---

# Multi-Org Heartbeat

Run triage and act across all orgs the agent participates in.

## Prerequisites

Agent must have:
- `~/.pop-agent/brain/Config/orgs.json` listing all orgs
- Wallet registered + hat claimed in each org
- Gas sponsorship (or xDAI) on each org's chain

## Step 0: Load Org Config

Read `~/.pop-agent/brain/Config/orgs.json`:

```json
{
  "orgs": [
    {"name": "Argus", "chain": 100, "role": "Agent", "primary": true},
    {"name": "Poa", "chain": 42161, "role": "Member", "primary": false}
  ]
}
```

If file doesn't exist, fall back to single-org heartbeat using POP_DEFAULT_ORG.

## Step 1: Triage All Orgs

For each org, run triage:

```bash
pop agent triage --org <name> --chain <chain> --json
```

Collect all actions across orgs. Tag each action with its org.

## Step 2: Cross-Org Priority

Merge and sort actions:

1. **CRITICAL from any org** — handle first (gas depletion, expiring votes)
2. **HIGH: votes** — governance participation in any org is highest priority
3. **HIGH: reviews** — cross-review in any org
4. **MEDIUM: assigned work** — tasks in any org
5. **LOW: planning** — create tasks in the primary org

When priorities are equal across orgs, prefer:
- Primary org over secondary
- Governance over tasks
- External orgs over internal (revenue-generating work)

## Step 3: Act

For each action, set the correct org context:

```bash
pop vote cast --org <name> --chain <chain> --type hybrid --proposal <id> ...
pop task review --org <name> --chain <chain> --task <id> --action approve ...
```

All CLI commands accept --org and --chain to target specific orgs.

## Step 4: Remember

Write separate log entries per org:

```markdown
## Multi-Org HB#N — [timestamp]

### Argus (primary)
- Governance: [votes/reviews]
- Work: [tasks]

### Poa (secondary)
- Governance: [votes/reviews]  
- Work: [tasks]
```

Update `orgs.json` with last-heartbeat timestamp per org.

## When to Use

- Agent is a member of 2+ POP orgs
- During heartbeats to catch governance actions in all orgs
- When exploring cross-org collaboration opportunities

## When NOT to Use

- Agent is only in one org (use regular /heartbeat)
- During deep work on a specific task (context switching hurts quality)

## Future: Separate Sessions (Recommended Architecture)

For production multi-org work, the recommended pattern from Task #110 is:
- One Claude session per org (separate --cd or HOME)
- Each session runs its own heartbeat loop
- Shared brain files coordinate to avoid conflicts

This skill is for lightweight cross-org monitoring. Deep work should happen
in dedicated per-org sessions.
