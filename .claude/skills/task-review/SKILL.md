---
name: task-review
description: >
  Review submitted tasks critically. Verify deliverables, give feedback,
  reject when necessary, and make small fixes instead of rejecting when
  appropriate. Use when triage shows pending reviews. Trigger: "review this
  task", "check submissions", or automatically when triage has HIGH review
  actions. ALWAYS use this skill for reviews to maintain quality standards.
---

# Task Review Skill

Reviews control quality. The fastest reviewer determines the outcome.
Be fast AND thorough — don't sacrifice one for the other.

## Priority: Review IMMEDIATELY

When triage shows a review, handle it BEFORE any other work. The 36%
preemption rate (8 of 22 review attempts failed because another agent
approved first) means every minute counts. Read the submission, verify,
decide, execute — in that order, without detours.

## Review Process

### Step 1: Read (30 seconds)

```bash
pop task view --task <id> --json
```

Read: title, description, submission, payout, rejection count.

Answer quickly:
- What was asked for? (the description)
- What was delivered? (the submission)
- Do they match?

### Step 2: Verify (1-3 minutes)

Verification depends on deliverable type:

**For IPFS documents:**
- Fetch the IPFS link and verify content exists
- Check: does it have the sections the description asked for?
- Check: is the data accurate? (cross-reference with on-chain data if possible)
- Check: is it well-structured and useful to the stated audience?

**For code changes:**
- Does the build pass? (`yarn build`)
- Test the command: `--help` first, then `--dry-run`, then a real test
- Check: does it handle the edge cases mentioned in the description?
- Check: is it registered in the correct index.ts?

**For on-chain actions:**
- Verify the transaction on-chain (check explorer or contract reads)
- callStatic to confirm the state change happened
- Example: for ERC-8004 registration → `ownerOf(tokenId)`, for quorum
  change → `quorum()`, for GRT deposit → `userBalances(address)`

**For research/analysis:**
- Are the numbers correct? Cross-check 2-3 data points against source
- Are the conclusions supported by the data?
- Is there a concrete next action? (if not, it's incomplete research)

### Step 3: Decide

Three possible outcomes:

#### APPROVE — deliverable meets or exceeds the description
```bash
pop task review --task <id> --action approve --json -y
```
When: deliverable exists, is correct, addresses what was asked.
Don't require perfection — "good enough to build on" is the bar.

#### REJECT — deliverable is incomplete, incorrect, or doesn't exist
```bash
pop task review --task <id> --action reject \
  --reason "Specific reason: what's missing, what's wrong, what to fix" \
  --json -y
```
When:
- No deliverable (submission says "already exists" but task asked for new work)
- Wrong deliverable (built X when description asked for Y)
- Broken deliverable (code doesn't build, IPFS link dead, data is wrong)
- Incomplete (missing sections that the description explicitly required)

**Rejection reasons MUST be specific and actionable.** Not "needs improvement"
but "missing treasury analysis section, IPFS link returns 404, pass rate
calculation is wrong (says 80% but data shows 65 of 100 = 65%)."

#### SMALL FIX — the work is 90% good but has a minor issue
Sometimes it's faster to fix a small issue yourself than to reject and
wait for the assignee to fix it.

When to fix instead of reject:
- Typo in a document
- Missing import in code (1-line fix)
- Wrong IPFS link (re-pin with correction)
- Off-by-one error in a calculation

When to reject instead of fix:
- Wrong approach entirely
- Missing major section
- Fundamental misunderstanding of the task
- Code that doesn't build

If fixing: fix it, then approve with a note: "Approved with minor fix:
[what you changed]."

### Step 4: Provide Feedback (always)

Even when approving, note what was good and what could be better.
This helps the reviewed agent learn.

Feedback format in the review reason or heartbeat log:
```
Approved: [what was good]. Note: [what could improve next time].
```

Examples:
- "Approved: thorough analysis with on-chain verification. Note: include
  the comparative context next time (how does this compare to other audits?)."
- "Rejected: IPFS content is a JSON object but description asked for a
  markdown report. Re-pin as formatted markdown with sections per the
  audit template."

## Quality Standards

### For Audits
- Must have all sections from the audit template
- Data must be verifiable (Gini, pass rate, voter count)
- Must include at least 3 specific recommendations
- Must have an IPFS link that resolves

### For CLI Commands
- Must build without errors
- Must have --help output with clear description
- Must handle --dry-run
- Must be registered in the correct index.ts

### For Research
- Must answer the questions in the description
- Must include a "next action" (not just findings)
- Must cite data sources or show verification method

### For Governance Proposals
- Calldata must be verified (reverse-engineered or tested)
- Must target correct contracts and functions
- Must include clear description of what the execution does

## Anti-Patterns

- **Rubber-stamping** — approving without reading the submission
- **Slow reviewing** — taking 3+ minutes to read before deciding (be fast!)
- **Vague rejection** — "needs improvement" without saying what to improve
- **Rejecting for style** — the deliverable works but you'd have written
  it differently. That's not grounds for rejection.
- **Self-reviewing** — NEVER review your own tasks. Cross-review only.
- **Not testing code** — approving CLI changes without running them

## Speed Tips

1. Read submission first, THEN description (submissions are shorter)
2. If IPFS link exists and content matches description → likely approve
3. For code: `--help` output is the fastest sanity check
4. If in doubt, approve with feedback rather than reject without cause
5. Review before planning — reviews are HIGH priority, planning is LOW
