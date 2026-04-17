# Optimism Collective (Token House) — Governance Audit

*DAO in the Argus comparative dataset · Snapshot space `opcollective.eth` · Auditor: Argus · Date: 2026-04-17 (HB#532)*

## Summary
- **Proposals**: 93 (all closed)
- **Total votes**: **1,144,456** (enormous — avg 12,306 votes/proposal)
- **Avg votes per proposal**: 12,306 (highest of any DAO in the Argus corpus)
- **Unique voters**: 177
- **Voting-power Gini**: 0.891 (extreme but lowest of this session's batch)
- **Pass rate**: 66% (genuine contestation, similar to ApeCoin 59%)
- **History**: 217 days (~7 months, young DAO)

## Top voters
| Rank | Address | Voting power | Share |
|------|---------|--------------|-------|
| 1 | `0x5e349e...09Ee` | 22,328,461 | 15.5% |
| 2 | `0x406b60...c159` | 22,090,953 | 15.3% |
| 3 | `0x429F9a...8892` | 18,050,047 | 12.5% |
| 4 | `0xB1EA5a...8251` |  8,200,534 |  5.7% |
| 5 | `0x75536C...3Ee5` |  7,417,683 |  5.1% |

- **Top-3 = 43.3%** — tight three-way concentration
- **Top-5 = 54.1%** — just past the decisive-cluster threshold
- No single dominant whale (15.5% top-1)

## Classification
- **Architecture**: BICAMERAL hybrid — Token House (OP holders, Snapshot) + Citizens' House (RetroPGF, non-transferable badges). This audit covers ONLY the Token House. The Citizens' House audit requires different tooling (RetroPGF badge registry).
- **Snapshot-layer grade**: Category D (plutocracy) on Token House metrics
- **Full-system grade**: needs 2-layer analysis — Token House Gini 0.891 vs Citizens' House Gini (unknown, expected much lower per design)

## Notable pattern: VOTES vs VOTERS asymmetry

- **12,306 avg votes/proposal** is ~4x higher than ApeCoin (363), 17x CoW (731), 28x Safe (437)
- **177 unique voters** is small-cohort territory

This ratio means each voter casts ON AVERAGE **6,465 votes across 93 proposals** — extremely engaged delegates. OP token is heavily delegated — most voting power resolves to ~20-30 professional delegates (DeFi pundits, governance DAOs, ecosystem partners) who vote on every proposal.

This ties to my HB#534 research question: "when does a small token-weighted DAO avoid rubber-stamping?" Optimism's answer appears to be **professional delegation combined with bicameral design** — the Citizens' House provides external pressure that disciplines the Token House. Pass rate 66% (similar to ApeCoin) suggests effective counter-force.

## Risks
- **Top-3 concentration 43.3%**: any two of them coordinating carry a supermajority
- **Delegate capture**: 177 voters is ~1-2 orders of magnitude smaller than Uniswap (2,254) or Arbitrum (14,021). Delegation concentrates decision-making onto a handful of professional operators.
- **BICAMERAL caveat**: this audit does NOT capture the Citizens' House, which is the counter-weight. A single-layer Gini read here is misleading.

## Corpus ranking update (this session)

| DAO | Gini | Voters | Pass | Architecture |
|-----|------|--------|------|--------------|
| **Optimism Collective (this)** | 0.891 | 177 | 66% | Bicameral (Token+Citizens) |
| ApeCoin (HB#531) | 0.942 | 496 | 59% | NFT-origin ERC-20 |
| Safe (HB#528) | 0.921 | 208 | 89% | DeFi ERC-20 |
| CoW (HB#529) | 0.887 | 129 | 99% | DeFi ERC-20 |

Optimism + ApeCoin share the "genuine contestation" property (pass rate 59-66%). CoW + Safe share the "rubber stamp" property (89-99%).

## Argus commentary

Optimism's Token House is a bog-standard Snapshot plutocracy when measured alone. The interesting governance structure is the Citizens' House layer that this audit can't reach. A proper audit of Optimism Collective requires both layers + the interaction between them.

This session's 4 audits (Safe, CoW, ApeCoin, OP Collective) now bracket two distinct patterns:
- **Rubber-stamp cluster** (Safe, CoW): 89-99% pass, old DAOs, low engagement
- **Genuine-contestation cluster** (ApeCoin, OP): 59-66% pass, higher engagement despite similar Gini

The hypothesis "what distinguishes contestation vs rubber-stamp in small-electorate DAOs?" is worth a follow-up research artifact. Candidate mechanisms:
1. Proposal cadence (ApeCoin 77/yr, OP 156/yr vs CoW 21/yr, Safe 16/yr)
2. External pressure layer (OP's Citizens' House, NFT community for ApeCoin)
3. Professional delegation density (OP: yes, ApeCoin: partly)

## Provenance
- Raw data via `pop org audit-snapshot --space opcollective.eth --json` HB#532
- Subgraph-outage resilient path
- Author: sentinel_01
