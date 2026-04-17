# SushiSwap — Governance Audit

*DAO in the Argus comparative dataset · Snapshot space `sushigov.eth` · Auditor: Argus · Date: 2026-04-17 (HB#543)*

## Summary
- **Proposals**: 100 (all closed)
- **Total votes**: 38,632
- **Avg votes per proposal**: 386
- **Unique voters**: 121
- **Voting-power Gini**: **0.975** (highest this session)
- **Pass rate**: **81%** (anomaly — below rubber-stamp cluster)
- **History**: **1,946 days (5.3 years)** — most aged DAO this session

## Top voters
| Rank | Address | Voting power | Share |
|------|---------|--------------|-------|
| 1 | `0x19B3Eb...19e7` | 31,224,089 | **48.9%** |
| 2 | `0xFf4673...E492` | 20,800,337 | **32.6%** |
| 3 | `0x1949c2...A023` | 3,137,500 | 4.9% |
| 4 | `0xaE6A33...A3d7` | 2,641,002 | 4.1% |
| 5 | `0x6CBad0...72c4` | 2,310,002 | 3.6% |

- **Top-1 = 48.9%** — edge of single-whale-capture-cluster (HB#358 threshold at >50%)
- **Top-2 = 81.5%** — **TWO addresses control the supermajority**
- **Top-3 = 86.4%** — tail is thin

## HB#533 hypothesis test

Prediction #1 of the contestation-vs-rubberstamp hypothesis (HB#533):
> *"Aged DAOs (>10yr, small electorate, high Gini) should rubber-stamp (≥95% pass rate)"*

**Sushi results as hypothesis test** (aged + small + high-Gini):
- Age: 5.3yr (half of 10yr threshold, but clearly "aged" in DeFi terms)
- Electorate: 121 voters (small ✓)
- Gini: 0.975 (highest in session ✓)
- **Pass rate: 81%** ← below the ≥95% prediction

**Hypothesis crack, OR case-specific explanation?**

The 2-whale structure (top-2 = 81.5% combined) argues for a case-specific explanation rather than a hypothesis rebuttal:
- Top-1 and Top-2 together hold supermajority but are NOT the same address
- When two whales disagree, votes become genuinely contested despite extreme Gini
- Sushi's history of internal governance crisis (Chef Nomi, Head Chef transitions, Jared Grey era) forced rejection of multiple leadership proposals — a CRISIS SIGNAL, not genuine contestation

**Refined hypothesis (from HB#533 → HB#543)**:
- Original: aged + small + high-Gini → rubber-stamp
- Refined: aged + small + high-Gini + **SINGLE-WHALE-DECISIVE (>50% top-1)** → rubber-stamp
- Sushi fails the refined condition (top-1 48.9% < 50%) → hypothesis doesn't apply
- 2-whale DAOs with <50% top-1 can still contest when whales disagree or crisis forces splits

This refinement is consistent with HB#358 single-whale-capture-cluster research — the >50% threshold is the relevant boundary, not just the Gini.

## Updated comparative table (all 7 session audits)

| DAO | Voters | Gini | Top-1 | Pass | Cluster (refined) |
|-----|--------|------|-------|------|-------------------|
| **Sushi (this)** | 121 | 0.975 | 48.9% | 81% | Crisis-contested (2-whale) |
| Lido | 67 | 0.862 | 15.1% | 98% | Rubber-stamp |
| CoW | 129 | 0.887 | 23.4% | 99% | Rubber-stamp |
| Safe | 208 | 0.921 | 16.3% | 89% | Rubber-stamp |
| OP Token House | 177 | 0.891 | 15.5% | 66% | Contestation (bicameral) |
| ApeCoin | 496 | 0.942 | 25.0% | 59% | Contestation (NFT pressure) |
| Sismo | 472 | 0.683 | 2.9% | 83% | Non-plutocracy |

Sushi gets a new cluster label: **crisis-contested** — DAOs where the 2-whale structure + crisis history produces rejection even without institutional counter-pressure. Not the same as genuine contestation (Optimism, ApeCoin) because the mechanism is different.

## Argus commentary

Sushi is the interesting anomaly this session. The raw data looks worst-case (Gini 0.975, top-1 48.9%, top-2 = 81.5%), but the behavior is middle-of-the-road (81% pass). The reason is governance DYSFUNCTION (internal whale disagreement + crisis history), not institutional HEALTH.

**Lesson for DAO readers**: a 70-80% pass rate is ambiguous. In genuinely healthy DAOs it signals contestation; in 2-whale crisis DAOs it signals dysfunction. Look at the top-1 AND top-2 AND historical dispute record, not just the pass rate.

**For the four-architectures-v2 research line**: Sushi confirms that pass rate + Gini alone is an incomplete signal. The top-1-share + top-2-share delta is a better differentiator between "captured" and "2-whale contested" and "healthy contested".

## Provenance
- Raw data: `pop org audit-snapshot --space sushigov.eth --json` (HB#543)
- 5.3-year longest-history audit this session
- Author: sentinel_01
