---
name: task-plan
description: >
  Plan task execution thoroughly before writing code or producing deliverables.
  Use after claiming a task and before starting work. Ensures you understand
  the requirements, have a clear approach, and won't waste effort. Trigger:
  "plan this task", "how should I approach this", or automatically after
  claiming a medium/hard task.
---

# Task Planning Skill

Plan like a principal engineer: understand the problem deeply, identify risks,
design the approach, THEN execute. The planning cost is ~5 minutes. The cost
of replanning after a failed attempt is ~30 minutes.

## Step 1: Understand the Task

Read the task description carefully. Answer:
- **What is the deliverable?** (code, document, proposal, research)
- **Who is the audience?** (other agents, external DAOs, Hudson, the public)
- **What's the acceptance bar?** (what would rejection look like?)
- **What prior work exists?** (related tasks, IPFS docs, code)

### Check Prior Art
```bash
pop task list --json | # search for related completed tasks
```
If someone did something similar before, READ their submission. Don't
reinvent. Build on existing work.

## Step 2: Identify Risks

Before starting, ask:
1. **What could go wrong technically?** (wrong calldata, API not available,
   contract not deployed, wrong chain)
2. **What could go wrong conceptually?** (wrong assumptions, stale data,
   scope too large)
3. **What don't I know?** (unfamiliar contracts, untested CLI commands,
   cross-chain mechanics)

For each risk, decide: research first or proceed and handle if it occurs.

### The Proposal #12 Rule
If encoding execution calls: **ALWAYS reverse-engineer a successful
transaction first.** Find a previous proposal that did something similar,
decode its calldata, and match the pattern. Never guess the ABI.

## Step 3: Design the Approach

Write a 3-5 step plan (mentally or in scratch):

```
1. [data gathering] — what queries/reads do I need?
2. [processing] — what analysis/transformation?
3. [production] — what do I create?
4. [verification] — how do I test/verify?
5. [delivery] — pin to IPFS, submit, update tracker
```

### For Code Tasks
- Read existing similar commands first (propose-quorum pattern)
- Check the ABI/contract interface
- Plan: write code → build → test (--dry-run) → verify → submit

### For Research Tasks
- Identify data sources (subgraph, on-chain reads, IPFS docs)
- Plan: gather → analyze → write → verify findings → pin → submit
- Must include: "what's the next concrete action?" (lesson from HB#5)

### For Governance Tasks
- Read relevant proposal history
- Plan: research config → encode calldata → dry-run → create proposal → vote
- Always test with callStatic before submitting

### For Audit Tasks
- Use the standardized audit template (QmaqQw...)
- Plan: run automated scan → narrative analysis → risk assessment →
  recommendations → pin → submit

## Step 4: Estimate and Commit

- Does this fit in one heartbeat? If not, break it up.
- Is this the highest-value action right now? Check action-values.json.
- Am I avoiding harder work by doing this? (metacognition check)

If the plan looks solid, start executing. Don't over-plan — the plan
should take 5 minutes max. Analysis paralysis is worse than a minor mistake.

## Step 5: Execute with Checkpoints

During execution, check at each step:
- Is the output matching what I planned?
- Did I discover something that changes the approach?
- Should I pivot or continue?

If pivoting: update the plan, don't just wing it. If the task turns out
to be bigger than expected, consider splitting.

## Anti-Patterns

- **Planning as work** — spending 30 minutes planning a 15-minute task
- **Skipping planning** — jumping straight to code for complex tasks
- **Ignoring prior art** — rebuilding something that exists
- **Not testing** — submitting without verifying (callStatic, --dry-run, IPFS fetch)
- **Scope creep** — the plan was "fix this bug" but you refactored 3 files
