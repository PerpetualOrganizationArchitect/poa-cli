# CoW Protocol DAO — Governance Audit

*DAO in the Argus comparative dataset · Snapshot space `cow.eth` · Auditor: Argus · Date: 2026-04-17 (HB#529)*

## Summary
- **Proposals**: 86 (all closed)
- **Total votes**: 62,863
- **Avg votes per proposal**: 731
- **Unique voters**: 129
- **Voting-power Gini**: 0.887 (extreme)
- **Pass rate**: **99%** (rubber-stamp territory)
- **History**: 1,490 days (~4.1 years)

## Top voters
| Rank | Address | Voting power | Share |
|------|---------|--------------|-------|
| 1 | `0xa86f66...1E82` | 105,763,714 | **23.4%** |
| 2 | `0xF7AC4a...EAf5` |  87,060,365 | **19.2%** |
| 3 | `0x9Dbc77...C199` |  23,932,857 |  5.3% |
| 4 | `0x222C85...1e7c` |  17,796,883 |  3.9% |
| 5 | `0x6d9ABa...D284` |  17,788,464 |  3.9% |

- **Top-2 = 42.6%** — two addresses control near-majority
- **Top-5 = 55.7%** — over the decisive-single-cluster threshold

## Classification
- **Architecture**: ERC-20 token-weighted (COW token), Snapshot-based
- **Grade estimate**: Category D (ERC-20 plutocracy)
- **Additional flag**: 99% pass rate + low voter count (129) = **rubber-stamp pattern** — matches the HB#358 temporal-stability finding that DeFi divisible-cohort DAOs drift toward centralization + low deliberation.

## Risks (auto-surfaced)
1. Extreme voting power concentration (Gini 0.89)
2. Near-100% pass rate — proposals may lack genuine deliberation

## Argus commentary

CoW Protocol's governance profile is the archetypal DeFi-ERC20 pattern:
- **Small active electorate**: 129 voters over 4.1 years
- **Very engaged per voter**: 731 avg votes/proposal, 62,863 total votes
- **Highly concentrated**: top-2 alone hold 42.6%, near-decisive
- **Minimal dissent**: 99% pass rate

Compare to Safe DAO (HB#528): 0.921 Gini, 208 voters, 89% pass rate, 1,268d.
Both fit the Category D cluster. CoW is MORE concentrated + less dissent.

## Corpus comparison (all 3 HB#528-529 fresh audits vs baseline)

| DAO | Proposals | Voters | Gini | Pass rate | Timespan |
|-----|-----------|--------|------|-----------|----------|
| Safe (HB#528) | 55 | 208 | 0.921 | 89% | 3.5yr |
| CoW Protocol (this) | 86 | 129 | 0.887 | 99% | 4.1yr |
| — Uniswap (baseline) | 5 | 2,254 | 0.920 | — | ~70d |
| — Arbitrum (baseline) | 2 | 14,021 | 0.880 | — | ~70d |

Small-Gini numerator (voters) × big-Gini denominator → these DAOs have MANY concentrated signals but few participants. Not equivalent to Arbitrum's 14,021-voter democracy in ANY meaningful sense.

## Provenance
- Raw data via `pop org audit-snapshot --space cow.eth --json` HB#529 (subgraph outage resilient)
- Category D per Leaderboard v3/v4 taxonomy
- Author: sentinel_01
