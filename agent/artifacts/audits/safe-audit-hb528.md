# Safe DAO — Governance Audit

*DAO in the Argus comparative dataset · Snapshot space `safe.eth` · Auditor: Argus · Date: 2026-04-17 (HB#528)*

## Summary
- **Proposals**: 55 (1 active, 54 closed)
- **Total votes**: 23,579
- **Avg votes per proposal**: 437
- **Unique voters**: 208
- **Voting-power Gini**: 0.921 (extreme concentration, top-5 hold 50.7% of power)
- **Pass rate**: 89%
- **History**: 1,268 days (~3.5 years)

## Top voters
| Rank | Address | Voting power | Share |
|------|---------|--------------|-------|
| 1 | `0xd714Dd...F3C8` | 21,168,394 | 16.3% |
| 2 | `0x8C28Cf...425c` | 15,700,901 | 12.1% |
| 3 | `0x8787FC...ea52` | 11,191,506 |  8.6% |
| 4 | `0x7A1057...4c67` |  9,691,960 |  7.5% |
| 5 | `0x3F15e2...7Cf5` |  8,000,003 |  6.2% |

Top-5 concentration: **50.7%**.

## Classification

- **Architecture**: ERC-20 token-weighted DAO (SAFE token), Snapshot-based voting
- **Grade estimate**: Category D (ERC-20 plutocracy cluster) — Gini 0.921 places it in the 0.85–0.98 modal band identified in the four-architectures-v2 research
- **Whale-resistance**: NONE structurally. Classic capital-proportional voting.

## Risks
- **Extreme voting power concentration**: Gini 0.92 means power is in the hands of a small set. Top voter alone has 16.3% — approaching the 'decisive-single-address' threshold (>50%) flagged in the Capture Cluster research.
- **No counter-pressure mechanism**: 89% pass rate over 1,268 days indicates modest rejection rate but no evidence of effective minority blocking.

## Recommendations (surfaced by pop org audit-snapshot)
1. Implement delegation programs to distribute voting power.

## Argus commentary

Safe is a major piece of infrastructure (multisig contracts underpin ~10% of ETH value locked), so its governance matters. The extreme concentration (Gini 0.921) is par for the course among token-weighted DeFi DAOs — it belongs firmly in the 'divisible ERC-20 cohort' identified by the temporal-stability finding: concentration drifts MORE concentrated over time rather than less.

Notably Safe's 208 unique voters over 3.5 years is ORDER OF MAGNITUDE SMALLER than Uniswap (2,254 voters in 70 days) or Arbitrum (14,021 in 70 days). Safe governance is thus BOTH less participatory AND more concentrated than the DeFi peer group — a combination that argues for moving decisions off-chain to Safe-maintainer stewardship OR reforming the tokenomics to broaden participation.

## Provenance
- Raw data captured via `pop org audit-snapshot --space safe.eth --json` HB#528
- Tool: src/commands/org/audit-snapshot.ts (works despite subgraph outage — pulls from Snapshot API directly)
- Author: sentinel_01
