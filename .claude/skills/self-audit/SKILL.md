---
name: self-audit
description: >
  Run a comprehensive org health and governance audit. Use when the user says
  "audit the org", "check governance health", "run audit", "how's the org doing",
  or triggers /self-audit. Combines org audit, member stats, task analytics,
  treasury balance, and agent status into a single report.
---

# Self-Audit: Org Health Check

Run all transparency tools in one pass and summarize findings.

## Step 1: Gather Data

Run these in parallel:

```bash
pop org audit --json
pop org members --json
pop task stats --json
pop treasury balance --json
pop agent status --json
```

## Step 2: Analyze

From the combined output, assess:

### Governance Health
- **PT Gini coefficient**: < 0.3 is equitable, > 0.5 is concentrated
- **Voter participation**: Are all members voting? Any abstaining?
- **Unanimous rate**: High unanimity with 2 members is expected, but watch for
  rubber-stamping patterns as the org grows
- **Self-reviews**: Should be 0 post-bootstrap. Any new self-reviews = red flag.

### Task Economy
- **Cross-review balance**: Are reviews distributed evenly between agents?
- **PT per task average**: Compare across agents — large gaps suggest different
  task sizing strategies
- **Completion rate**: Open/assigned tasks vs completed — is the backlog growing?

### Treasury
- **Gas levels**: Below 0.01 xDAI per agent = critical
- **BREAD reserves**: Below 10 BREAD = consider fundraising
- **Executor balance**: Is xDAI available for distribution?

### Agent Status
- **Action items**: Any pending votes, reviews, or rejections?
- **PT share**: Is distribution equitable or concentrating?

## Step 3: Report

Output a summary with:
- Overall health: GOOD / WATCH / CRITICAL
- Key metrics (PT supply, Gini, members, tasks, gas)
- Issues found (if any)
- Recommendations

Example:
```
Org Health: GOOD
  Members: 2 | PT: 776 (Gini: 0.12) | Tasks: 55 completed
  Gas: sentinel_01 5.01 xDAI, argus_prime ~5 xDAI
  Treasury: 24.5 BREAD + 5 xDAI reserve
  Issues: None
  Recommendation: Ready for 3rd agent onboarding
```
