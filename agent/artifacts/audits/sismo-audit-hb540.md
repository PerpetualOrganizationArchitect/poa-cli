# Sismo DAO — Governance Audit

*DAO in the Argus comparative dataset · Snapshot space `sismo.eth` · Auditor: Argus · Date: 2026-04-17 (HB#540)*

## Summary
- **Proposals**: 12 (all closed)
- **Total votes**: 26,185
- **Avg votes per proposal**: 2,182
- **Unique voters**: 472
- **Voting-power Gini**: **0.683** (LOW — non-plutocracy)
- **Pass rate**: 83%
- **History**: 460 days (~1.3 years)

## Top voters
| Rank | Address | Voting power | Share |
|------|---------|--------------|-------|
| 1 | `0x4801eB...58F1` | 3,500 | **2.9%** |
| 2 | `0xd976D3...302d` | 3,500 | **2.9%** |
| 3 | `0xA2e700...1870` | 3,500 | **2.9%** |
| 4 | `0xd70333...315E` | 3,500 | **2.9%** |
| 5 | `0xECD028...6D74` | 3,500 | **2.9%** |

**Top-5 all at exactly 2.9%** — this is the **identity-badge architecture signature**. Every voter holds the same (or capped) voting weight regardless of capital. Top-voter share of 2.9% is two orders of magnitude lower than the ERC-20 cohort's 15-25% range.

## Classification
- **Architecture**: **Identity badge / proof-of-humanity** (per four-architectures-v2 taxonomy)
- **Mechanism**: Sismo issues verifiable identity attestations (ZK-based badges). Voting rights flow from badges, NOT from capital. Each holder gets a bounded share.
- **Grade estimate**: exits Category D. Clear member of the 4-architecture whale-resistant cluster.

## Comparison: ERC-20 plutocracies vs identity-badge this session

| DAO | Architecture | Voters | Gini | Top-1 | Pass |
|-----|-------------|--------|------|-------|------|
| **Sismo (this)** | Identity badge | 472 | **0.683** | **2.9%** | 83% |
| Lido | ERC-20 | 67 | 0.862 | 15.1% | 98% |
| CoW | ERC-20 | 129 | 0.887 | 23.4% | 99% |
| Safe | ERC-20 | 208 | 0.921 | 16.3% | 89% |
| OP Token House | ERC-20 | 177 | 0.891 | 15.5% | 66% |
| ApeCoin | ERC-20 NFT-origin | 496 | 0.942 | 25.0% | 59% |

Sismo's Gini is **0.2 lower** than the next-lowest in the set (OP at 0.891). Top-1 share is **5.3x smaller** than the smallest ERC-20 top-1 (Lido/OP at 15%). That's not a continuous gradient — it's a structural discontinuity.

## Fit with contestation-vs-rubberstamp hypothesis (HB#533)

Sismo doesn't cleanly fit either cluster:
- 83% pass rate is between the clusters (rubber-stamp 89-99% vs contestation 59-66%)
- Low proposal cadence (~9/yr) puts it in the rubber-stamp side mechanically
- But the structural selection effect (identity, not capital) means rubber-stamping would require 100+ identity-holders colluding — MUCH harder than 2 whales in CoW aligning

The hypothesis needs expansion: identity-badge DAOs may pass rate high while still being structurally contestation-resistant. Pass rate alone isn't a complete signal when the underlying voter set is anti-plutocratic.

## Argus commentary

Sismo refreshes the four-architectures-v2 dataset. The 5 top voters ALL at EXACTLY 2.9% is diagnostic — this is what a capped-per-badge architecture produces in the wild. No ERC-20 DAO I've audited has this profile.

**Data relevance for the Sprint 18 `unified-ai-brain` spinoff**: Sismo's model is one of the 4 templates the spinoff should include. A dao-template catalog with (POP-discrete, Nouns-NFT-auction, Sismo-identity-badge, Aavegotchi-gameplay) + the Apprentice-role template from HB#530 would cover the main whale-resistant patterns.

## Provenance
- Raw data: `pop org audit-snapshot --space sismo.eth --json` (HB#540)
- Author: sentinel_01
