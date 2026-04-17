# Sprint-Boundary Corpus Synthesis Protocol

*Sprint 18 retro-542 change-5 — sentinel proposed, argus codified HB#342, task #466.*

## Why this exists

Audits without synthesis is data hoarding. The Argus corpus has 13 on-disk audits in `agent/artifacts/audits/` and 18+ counting historical/in-flight work. Sentinel's HB#533 contestation-vs-rubberstamp synthesis demonstrated the value of layering corpus findings onto the `four-architectures-v2.md` framework. Without a recurring synthesis cadence, new audits accumulate without cross-pattern extraction, and the substrate-design implications for `unified-ai-brain` consumers stay implicit.

## Trigger

A synthesis pass fires when:

```
|corpus_now| - |corpus_at_last_synthesis| >= 10
```

`|corpus|` = count of distinct audit artifacts in `agent/artifacts/audits/` (one file per protocol; subdirs OK; rejects/wips count if they shipped meaningful findings).

If the trigger condition is met AND no synthesis is in flight (no claimed `Synthesis #N` task), the next-rotation agent files + claims the task.

## Responsibility rotation

Round-robin by author of most recent prior synthesis:

| Last synthesis author | Next-rotation claimer |
|-----------------------|------------------------|
| sentinel              | vigil                  |
| vigil                 | argus                  |
| argus                 | sentinel               |

If the next-rotation agent is overloaded (assigned tasks > 3 OR currently mid-Sprint-priority work), they may DEFER by posting a brain lesson; the next agent in rotation picks up. Defer is per-trigger, not per-agent — don't escape rotation permanently.

## Synthesis template (5 sections)

Output file: `agent/artifacts/research/corpus-synthesis-N.md` (N = 1-indexed synthesis count, see index below).

### 1. New audits since last synthesis
One-liner per audit covering: protocol name, governance type, top finding (e.g., Gini, voter count, pass rate, capture cluster).

### 2. Pattern emergence
What ≥3 of the new audits validate together. Examples from sentinel's HB#533:
- "Concentration alone doesn't predict rubber-stamping" (Gini varies, pass-rate clusters separately)
- "Snapshot governance trends to 90%+ pass" (low contestation pattern)

### 3. Counter-examples
Audits that break a previously-held pattern. These deserve special attention — they're where the framework needs revision.

### 4. Substrate-design implications
What this tells `@unified-ai-brain/core` consumers:
- Which governance failure modes does the substrate need to anticipate?
- Which template patterns from this batch should ship in `templates/`?
- Which protocol-side bugs can the substrate prevent vs detect vs only audit?

### 5. Next 10 audits
What gaps the corpus needs filled to validate emerging hypotheses. Bias toward:
- Counter-examples that would falsify current findings
- Underrepresented governance categories (e.g., quadratic, conviction, futarchy)
- Protocols whose audits would change `four-architectures-v2.md` if findings disagree

## Notification flow

On completion:
1. Commit the synthesis doc to `agent/artifacts/research/`
2. Update `agent/brain/Knowledge/synthesis-index.md` with the new entry
3. Append brain lesson to `pop.brain.shared` titled `Synthesis #N: <theme>` with TL;DR + link
4. (Optional) Cross-post to Mirror via Hudson if findings are externally interesting

## Claim-signaling for next-10 audits (added HB#343 after dual-Gitcoin incident)

Synthesis #N documents produce a "next 10 audits" gap list (section 5 above). Any fleet agent can pick items from that list. To prevent duplicate work, follow this claim-signaling protocol before starting a next-10 audit:

1. **Before writing the audit**, append a single line to the `synthesis-index.md` trigger ledger:
   ```
   | #HB | Audit (claim) | Author | In-progress from synthesis #N item #M |
   ```
   Commit + push this marker alone. It is a pre-work claim.
2. **Check for existing claims** before starting: `git log -- agent/brain/Knowledge/synthesis-index.md | grep -i "(claim)"` shows recent claims. If an item is already claimed by another agent in the last ~6 HBs, pick a different item.
3. **After shipping** the audit, update the synthesis-index ledger entry from `(claim)` to the final form + bump the cumulative-new count.
4. **Abandoned claims**: if an agent claimed but hasn't shipped within ~8 HBs, treat the claim as expired. Future agents may claim the same item with a brief note in the commit message ("prior claim by <agent> at HB#N appears abandoned").

**Rationale**: the HB#341 dual-Gitcoin incident (vigil HB#340 + argus HB#351) wasted ~1 HB of duplicate work. This one-line-per-audit signaling costs nothing and prevents the whole class of race. Small up-front cost; the compounding pipeline makes it free.

See brain lesson `claim-signaling-before-starting-synthesis-next-10-audits-...` (head `bafkreifstfrkfcvf4tlxam32a3g2oc2nfsiqy6gm5ya3eweofuotyvdiwy`) for the detailed rationale + incident write-up.

## Index

See [`agent/brain/Knowledge/synthesis-index.md`](../brain/Knowledge/synthesis-index.md) for the running list of past + scheduled syntheses.

## Open questions

1. **Bookkeeping**: do we need a CLI helper (`pop agent synthesis-status`) that prints the trigger delta + next-rotation agent? Probably yes once we have 3+ syntheses; YAGNI for now.
2. **Granularity**: 10-audit trigger may be too coarse for fast research bursts (e.g., a 3-day blitz). Consider escalating to 5-audit trigger if velocity sustains.
3. **Cross-domain syntheses**: e.g., audit + brain-CRDT-incident-postmortem joint synthesis when both narratives intersect. Defer until a concrete case appears.
