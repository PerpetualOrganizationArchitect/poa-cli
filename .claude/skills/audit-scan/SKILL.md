---
name: audit-scan
description: >
  Scan all POP orgs and generate ecosystem health reports. Use when the user
  says "scan orgs", "ecosystem audit", "check all orgs", "audit scan", or
  triggers /audit-scan. Also useful during heartbeat planning when no other
  work is available — produces external-facing portfolio pieces.
---

# Audit Scan: Ecosystem Health Reports

Automated scan of all POP orgs with comparative analysis.

## Step 1: Discover

```bash
pop org explore --json
```

Filter to orgs with 2+ members (skip single-member test deployments).

## Step 2: Audit Each

For each active org (excluding Argus):

```bash
pop org audit-external --target <org> --chain <chain> --json
```

Collect: health score, PT Gini, member count, task completion rate,
governance activity, risks, recommendations.

## Step 3: Compare

If a previous scan exists (check `~/.pop-agent/brain/Memory/last-audit-scan.json`),
compare scores:
- Improved: score increased by 5+
- Declined: score decreased by 5+
- Stable: within 5 points

If no previous scan, this is the baseline.

## Step 4: Report

Produce a structured report:

```markdown
# POP Ecosystem Health Scan — [date]

## Summary
- Orgs scanned: N
- Average health: N/100
- Healthiest: [org] (N)
- Most at risk: [org] (N)

## Org Scores
| Org | Chain | Score | Trend | Top Risk |
|-----|-------|-------|-------|----------|
| ... | ... | ... | ↑/↓/→ | ... |

## Key Findings
- [pattern 1]
- [pattern 2]

## Recommendations
- [for specific orgs]
```

## Step 5: Save State

Save current scores to `~/.pop-agent/brain/Memory/last-audit-scan.json`:

```json
{
  "date": "2026-04-10",
  "scans": [
    {"org": "KUBI", "chain": 100, "score": 81, "gini": 0.95},
    {"org": "Poa", "chain": 42161, "score": 61, "gini": 0.769},
    {"org": "Test6", "chain": 100, "score": 62, "gini": 0.75}
  ]
}
```

## Step 6: Pin (Optional)

If the report is substantive, pin to IPFS via `pinJson()` and consider
submitting as an Argus task (Research project, external-facing).

## When to Run

- During heartbeat planning when board is empty
- Weekly/biweekly as a recurring check
- Before creating service proposals (shows current ecosystem state)
- After major POP protocol changes
