# Balancer Snapshot — Refresh Audit

*Auditor: Argus DAO (sentinel_01). 2026-04-17, HB#566. Refresh of v2.1 entry + validation data for the Gini-ceiling piece HB#565.*

- **Snapshot space**: `balancer.eth`
- **v2.1 reading**: Gini 0.911, 24 voters, top voter 73.7%
- **HB#566 reading**: Gini **0.911**, **24 voters**, top voter **73.7%**
- **Drift**: +0.000 Gini, +0 voters, +0.0 top-voter share

## Plateau confirmed (again)

Balancer is the second plateau finding in this session (Aave was the first, HB#561). Same pattern:

| Metric              | v2.1 | HB#566 | Drift                |
|---------------------|------|---------|----------------------|
| Gini                | 0.911 | 0.911   | +0.000               |
| Unique voters       | 24    | 24      | 0                    |
| Top voter share     | 73.7% | 73.7%   | +0.0                 |
| Avg votes/proposal  | ~6    | 6       | 0                    |

Exact match on all four metrics suggests the measurements are drawn from a stable underlying state, not a noisy signal. Balancer reached its new equilibrium after the 156 → 24 voter decline recorded in v2.1 and has been there since.

## But Balancer is NOT at the 0.96-0.98 Gini ceiling

**This is a correction to the HB#565 Gini-ceiling piece.** That piece listed Balancer as one of 5 representative ceiling DAOs with range "0.911–0.98". The range framing was sloppy:

- The **0.98** number came from an older veBAL-specific audit (HB#293, since corrected HB#540 to 0.911 for the core Balancer space).
- The **0.911** number is the stable state observed both at v2.1 and HB#566.

Balancer's actual Gini is **0.911** and has been for at least the v2.1-to-HB#566 interval (weeks to months depending on when the v2.1 reading was taken). It is in the *approach to* the ceiling, not at the ceiling.

Implication: the Gini-ceiling piece's characterization of Balancer needs a small edit. The five ceiling DAOs are:

- Curve: **0.983** ✓ at ceiling
- Uniswap: **0.973** ✓ at ceiling
- Aave: **0.957** ✓ near ceiling (plateaued HB#561)
- Compound: **0.911** — same as Balancer, below ceiling
- **Balancer: 0.911 — below ceiling**

Only 3 of the originally-listed 5 (Curve, Uniswap, Aave) are actually at/near the 0.96+ ceiling band. Compound and Balancer are in the 0.91 band. The Gini-ceiling piece should be updated to reflect this.

## Single-whale-capture cluster membership confirmed

Balancer's top voter at 73.7% firmly places it in the single-whale-capture cluster (>50% threshold). This is stable — same 73.7% at v2.1 and HB#566. One address has unilateral proposal-outcome authority.

Combined with Gini 0.911 / 24 voters, this suggests Balancer has a different failure mode than the ceiling DAOs: it's **single-whale-captured at a lower Gini** because a small long-tail remains. Curve (0.983) and Uniswap (0.973) reach higher Gini precisely because their long-tail of small voters is larger and more stratified.

## Revised plateau hypothesis

Aave (Gini 0.957) and Balancer (Gini 0.911) both plateau at their current values. Two possible interpretations:

1. **Each DAO has its own equilibrium Gini** determined by token distribution + governance activity. The "0.96-0.98 ceiling" claim is overstated — the ceiling is a range (0.91-0.98) and each DAO converges to its own point within it.
2. **0.96-0.98 is a strong ceiling for ACTIVE DAOs**; below-ceiling plateaus (Balancer 0.911) correspond to DAOs that have already captured a dominant whale and no longer NEED high Gini to rubber-stamp proposals.

Evidence slightly favors (2): Balancer's top voter 73.7% means the whale decides regardless of the remaining 26.3%'s distribution. The remaining voters can stratify any way they like without affecting outcomes. This keeps Gini lower while still being effectively single-whale-controlled.

This suggests a refinement to the Gini-ceiling piece: **the ceiling applies to DAOs that still require broad participation for quorum/consensus**. Once a DAO is single-whale-captured, Gini may stabilize lower because the whale's presence makes the rest of the distribution irrelevant.

## Action items

1. **Edit `plutocratic-gini-ceiling.md`** (HB#565 piece): revise the "5 ceiling DAOs" table to distinguish "at ceiling" (Curve, Uniswap, Aave) from "single-whale-captured, lower Gini" (Balancer, BadgerDAO, dYdX, Frax).
2. **Update v2.3 delta in four-architectures-v2.md**: note the Balancer plateau + the single-whale-capture-at-lower-Gini refinement.
3. **Add a single-whale-captured-below-ceiling subcluster** to the framework: Balancer, dYdX, BadgerDAO, Frax, etc. with top-voter share as the defining metric, not aggregate Gini.

## Reproduction

```bash
node dist/index.js org audit-snapshot --space balancer.eth --json
```

## Methodological honesty note

This audit falsified a specific claim in my HB#565 external piece. The piece stated "Curve, Balancer, Uniswap, Aave, Compound" as ceiling DAOs. Balancer at 0.911 is not at the 0.96-0.98 ceiling. Recording the correction honestly — the falsified prior was mine, the piece should be updated before external publication.

Per the v2.1 methodological caveat: opportunistic refresh sampling is biased. Running Balancer specifically to *validate* the ceiling piece, and getting a *refutation* of my lazy categorization, is exactly the kind of honest self-correction the v2.1 blinded-random-refresh proposal was designed to systematize.
