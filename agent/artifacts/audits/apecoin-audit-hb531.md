# ApeCoin DAO — Governance Audit

*DAO in the Argus comparative dataset · Snapshot space `apecoin.eth` · Auditor: Argus · Date: 2026-04-17 (HB#531)*

## Summary
- **Proposals**: 100 (all closed)
- **Total votes**: 36,342
- **Avg votes per proposal**: 363
- **Unique voters**: 496
- **Voting-power Gini**: **0.942** (extreme; higher than Safe + CoW)
- **Pass rate**: 59% (NOT rubber-stamp — genuine rejection rate)
- **History**: 462 days (~1.3 years)

## Top voters
| Rank | Address | Voting power | Share |
|------|---------|--------------|-------|
| 1 | `0x9545ea...F2Bf` | 62,100,232 | **25.0%** |
| 2 | `0x5edF85...8d5b` | 60,065,458 | **24.2%** |
| 3 | `0x33924a...9cf2` | 19,584,804 |  7.9% |
| 4 | `0x9AD85d...048b` |  7,597,938 |  3.1% |
| 5 | `0x06d49F...C4e8` |  7,362,473 |  3.0% |

- **Top-2 = 49.2%** — essentially a two-whale voting cartel
- **Top-5 = 63.2%** — past the decisive-single-cluster threshold
- **Gini 0.942** is HIGHER than CoW (0.887) and Safe (0.921)

## Classification
- **Architecture**: ERC-20 token-weighted (APE token), Snapshot-based
- **Ecosystem**: originally gifted to BAYC/MAYC NFT holders + YugaLabs allocation
- **Grade estimate**: Category D (plutocracy) — on the upper concentration end of the DeFi cluster
- **Notable pattern**: 59% pass rate is GENUINELY contested — proposals ARE rejected. This differs from the CoW/Safe 89-99% pass rate pattern. Either (a) the Top-2 don't always agree, so disputes surface, or (b) other active voters can still block with coordinated effort below the top-2.

## Risks
- **Two-whale near-majority**: Top-2 holders combined = 49.2%. They need one small holder to reach >50%. This is the pre-captured structural state that precedes full capture.
- **Gini 0.942**: among the highest in the Argus corpus. Matches the HB#358 single-whale-capture-cluster criteria (>50% top-voter threshold) is close but not yet crossed.

## What makes this different from previous audits
- **59% pass rate** (not 89-99%) shows genuine deliberation — proposals CAN fail. Good governance signal.
- **496 voters** in 1.3 years is low absolute but per-month is ~32 unique voters/month, higher than CoW (~8/mo) or Safe (~5/mo).
- **100 proposals** in 1.3yrs = 77 props/year, very high proposal cadence vs Safe (16/yr) and CoW (21/yr). High-frequency governance.

## Argus commentary

ApeCoin is a rare specimen — a DAO originally gifted to NFT holders (BAYC/MAYC) that retains the ERC-20 plutocracy structure typical of late-stage token DAOs, BUT still shows genuine deliberation (59% pass rate). The 2-whale near-majority concentration is alarming — at 49.2%, one small coordinated bloc flips to >50% and the DAO becomes fully captured. This is the "watch this one" pattern.

The high proposal cadence (77/yr) also makes ApeCoin a data-rich case for studying governance-decision pacing. Something to extract in a follow-up research note.

## Corpus comparison (5-way, this session's fresh + baselines)

| DAO | Props | Voters | Gini | Pass | Timespan |
|-----|-------|--------|------|------|----------|
| **ApeCoin (this)** | 100 | 496 | 0.942 | 59% | 1.3yr |
| CoW (HB#529) | 86 | 129 | 0.887 | 99% | 4.1yr |
| Safe (HB#528) | 55 | 208 | 0.921 | 89% | 3.5yr |
| Uniswap (baseline) | 5 | 2,254 | 0.920 | — | 70d |
| Arbitrum (baseline) | 2 | 14,021 | 0.880 | — | 70d |

ApeCoin is the only one with a meaningful pass-rejection ratio among the small-electorate DAOs. An interesting anomaly to flag for future research: "when a small token-weighted DAO still rejects, what's the mechanism?"

## Provenance
- Raw data via `pop org audit-snapshot --space apecoin.eth --json` HB#531
- Subgraph-outage resilient path
- Author: sentinel_01
