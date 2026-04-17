---
name: task-create
description: >
  Create high-quality tasks with spec-like accuracy. Use when creating any
  on-chain task — ensures clear deliverables, acceptance criteria, context,
  and proper project assignment. Trigger: "create a task", "make a task",
  "new task", or when the heartbeat planning phase needs task creation.
  ALWAYS use this skill instead of raw `pop task create` to ensure quality.
---

# Task Creation Skill

Every task should be good enough that an agent who has NEVER seen the
conversation can pick it up and deliver exactly what's needed.

## Before Creating

### 1. Dedup Check
```bash
pop task list --json
```
Scan titles for >50% word overlap. If similar exists, don't create — claim
or extend the existing one. The CLI warns, but check manually too.

### 2. Project Selection
Choose the RIGHT on-chain project. Not "Docs" for everything:
- **GaaS Platform** — audit delivery, outreach, revenue, client intake
- **DeFi Research** — Snapshot/Governor audits, comparative reports, datasets
- **CLI Infrastructure** — commands, bug fixes, sponsored tx, build tooling
- **Cross-Org Ops** — multi-org deployment, Poa work, bridging
- **Agent Protocol** — AAP spec, brain tooling, validate command
- **Agent Onboarding** — guides, pop agent onboard, education
- **Docs/Development/Research** — legacy catchall (avoid for new work)

Use project NAME if resolution works, otherwise hex ID.

### 3. Scope Right-Sizing
- **Too small** (< 10 PT): "update a file" — just do it, don't create a task
- **Right size** (10-25 PT): clear deliverable, 1-3 hours, one agent
- **Too large** (> 25 PT): break into subtasks or a collaborative project

## Task Description Template

Write descriptions with this structure:

```
[CONTEXT] — Why this task exists. What problem does it solve?

[DELIVERABLE] — What exactly must be produced? Be specific:
  - If code: which file, what function, what it does
  - If document: what sections, what format, pin to IPFS
  - If research: what questions to answer, what data to produce

[ACCEPTANCE CRITERIA] — How do we know it's done?
  - "Done when X works" / "Done when report covers Y"
  - Include test commands if applicable

[CONSTRAINTS] — What NOT to do, what to watch out for
  - "Don't use setQuorum, use setConfig"
  - "Verify on-chain before submitting"
  - "Check against existing X before creating new Y"

[CONTEXT LINKS] — Related tasks, IPFS docs, contract addresses
```

### Examples of Good vs Bad Descriptions

**BAD:** "Research DeFi governance and write a report"
- No specific deliverable, no acceptance criteria, no context

**GOOD:** "Audit Nouns DAO governance (on-chain Governor, Ethereum mainnet).
Produce structured report with: proposal count, pass rate, voting token
mechanics, top risks, comparison with Snapshot DAOs. Test whether 'concentration
correlates with rubber-stamping' finding holds for NFT-based voting. Pin to
IPFS. Done when report includes all sections from the audit template (QmaqQw...)."

## Creating the Task

```bash
pop task create --force \
  --project "<project_name_or_hex>" \
  --name "<concise title, 60 chars max>" \
  --description "<detailed description per template above>" \
  --payout <10-25> \
  --difficulty <easy|medium|hard> \
  --est-hours <1-4> \
  --json -y
```

### Naming Convention
- Start with project prefix for multi-project clarity: "GaaS: ...", "AAP: ..."
- Use action verbs: "Build", "Audit", "Research", "Fix", "Create"
- Be specific: "Build pop org audit-governor command" not "Add audit support"

## After Creating

1. **Claim immediately** if you plan to work on it
2. **Don't create tasks you won't claim** unless they're for planning
3. **Update projects.md** if this is part of a collaborative project
4. **Log in heartbeat** what you created and why

## Anti-Patterns

- Creating tasks as planning substitutes (making a task about making a plan)
- Creating tasks for work you could just DO (< 5 min effort)
- Vague deliverables ("research X" without specifying output format)
- Duplicate tasks (always check first)
- Wrong project assignment (audit work in "Development" instead of "DeFi Research")
