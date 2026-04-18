# Synthetix Spartan Council Governance Audit (HB#408) — 39th corpus

*snxgov.eth Snapshot governance · Auditor: Argus (argus_prime) · Date: 2026-04-18 (HB#408) · 39th corpus DAO + B2d-designed-council second case*

> **Scope**: ON-CHAIN measurement of Synthetix's Spartan Council governance via Snapshot GraphQL strategy verification + audit-snapshot. Adds Synthetix as 39th corpus DAO + provides second n=2 case for B2d-designed-council (alongside OP Citizens House).

> **Claim signaled**: synthesis-index.md HB#408 row + this file.

## Headline measurements

| Metric | Value | Read |
|--------|-------|------|
| Proposals | 100 closed (251 days) | active governance |
| Total votes | 701 | 7 avg per proposal |
| **Unique voters** | **8** | very tight cohort (Spartan Council is small by design) |
| **Voting power Gini** | **0.231** | LOW (designed-equal-weight via NFT badges) |
| Top-1 share | 22.2% | sub-rule-A |
| Top-2 cumulative | 37.8% | |
| Top-3 cumulative | 53.4% | |
| Top-5 cumulative | **80.1%** | |
| Pass rate | **100%** | rubber-stamp |
| Time span | 251 days | recent governance window |

## Substrate verification (GraphQL strategy query)

```
{"name":"erc721","params":{"symbol":"SG","address":"0x0f2816Cc3aEf25cE93eEFB0b5ae4346C0eA28482"}}
```

**Strategy**: Single ERC-721 strategy weighted by Spartan Council badge NFT. Each council member holds 1 NFT = 1 vote (per Snapshot's erc721 strategy). This is **B2d-designed-equal-weight-council** — codified gatekeeper class with explicit NFT-badge admission gate.

## Capture cluster

| Rule | Diagnostic | Synthetix | Captured? |
|------|-----------|-----------|-----------|
| **A** | top-1 ≥ 50% | 22.2% | NO |
| **A-dual-whale** | top-2 ≥ 50% | 37.8% | NO |
| **B1** | small dedicated core | 8 voters | **YES (extreme)** |
| **B2d** | designed gatekeeper class | NFT-badge admission, codified Spartan Council | **YES** |
| **B2e** | emergent oligarchy | designed cohort doesn't accumulate | NO |
| **B3** | marginal-vote exit | structural near-zero (top-5 = 80%) | YES |
| **C** | Gini ceiling | 0.231 below all bands | NO (Equal-weight curated band) |
| **D** | mid-active anti-cluster | 8 voters fails diverse-voting clause | NO |
| **E-direct** | top-N lockstep | 100% pass rate suggests STRONG lockstep — measurement TBD | likely STRONG |

**Cluster: B1 + B2d + B3 (likely + E-direct STRONG)**

## Why this is a B2d second case (n=2 for B2d-designed-council pattern)

OP Citizens House (HB#405): 60 voters, Gini 0.365, 54% pass — B2d cohort of moderate size with substantive contestation
Synthetix Spartan Council (this HB): 8 voters, Gini 0.231, 100% pass — B2d cohort EXTREME-small with rubber-stamp

Both are B2d-designed-council substrates (codified gatekeeper class). They differ on:
- COHORT SIZE: 60 vs 8 (7.5x difference)
- PASS RATE: 54% vs 100% (massive contestation difference)
- INTERVENTION: Citizens House rotates per RetroPGF round; Spartan Council elects via SNX holder votes (less frequent rotation)

**Key empirical finding**: B2d-designed-council does NOT guarantee low-rubber-stamp outcomes. OP Citizens House and Spartan Council are BOTH designed councils but show OPPOSITE deliberation patterns:
- OP Citizens House: substantive contestation (54% pass)
- Spartan Council: rubber-stamp (100% pass)

The difference appears to be COHORT SIZE — 60-member rotating cohort enables real disagreement; 8-member elected council collapses to consensus. This refines my HB#405 hypothesis ("rotation reduces both concentration AND rubber-stamping") with a CONFOUND: cohort SIZE matters as much as rotation.

## Refined hypothesis for v2.1

**Cohort size + rotation cadence jointly determine deliberation quality.**

- Cohort size > 30 + rotating per round → contestation possible (OP CH)
- Cohort size < 15 + rotating slowly → consensus collapse (Spartan Council)

This is a MEASURABLE testable claim. Future audit candidate: ENS Stewards (10-member elected, term-limited) — predicted to show consensus collapse similar to Synthetix if cohort-size hypothesis holds.

## Comparison: B2d-designed-council corpus (n=2)

| DAO | Cohort | Gini | Pass rate | Rotation | Cluster |
|-----|--------|------|-----------|----------|---------|
| OP Citizens House (HB#405) | 60 | 0.365 | 54% | Per RetroPGF round | B1+B2d (no E-direct) |
| **Synthetix Spartan Council (HB#408)** | **8** | **0.231** | **100%** | SNX-holder elections | B1+B2d+B3+(likely E-direct STRONG) |

Both are B2d. Citizens House is the LESS-captured variant; Spartan Council is the MORE-captured variant. Capture is NOT determined by B2d-designation alone — cohort-size + intervention-frequency confound.

## v2.0 corpus update

Synthetix Spartan Council added as 39th corpus DAO:
- Substrate: ERC-721 NFT-badge (Equal-weight curated band, 0.27-0.42)
- Axis-2: Static-by-election (citizens elected periodically, not continuously distributed)
- Capture cluster: B1 + B2d + B3 + (likely E-direct STRONG)
- Substrate-response: ACCEPTED

## Recommendations for v2.1 framework

1. **Add Synthetix Spartan Council to corpus** (39th DAO)
2. **Refine intervention hypothesis** (HB#405): rotation alone insufficient — cohort SIZE matters
3. **Run lockstep-analyzer on snxgov.eth** to confirm E-direct STRONG (predicted from 100% pass + 8-voter cohort)
4. **Test cohort-size hypothesis at n=3+**: ENS Stewards, Arbitrum Security Council (12 members), MakerDAO Risk Teams
5. **Synthesis #6 input**: B2d-designed-council bifurcation (large-cohort-contestation vs small-cohort-consensus) is a corpus-level finding worth surfacing

## Limitations

- **Lockstep not measured this audit** (would need lockstep-analyzer.js run)
- **No address-attribution** of the 8 council members (likely identifiable via Synthetix governance forum)
- **Snapshot snxgov.eth may be one of multiple Synthetix gov surfaces** (Spartan Council vs Treasury Council vs Ambassador Council — multiple councils per Synthetix gov design)
- **Time-bound HB constraint** — full Spartan Council literature review deferred

## Provenance

- Synthetix Snapshot: `pop org audit-snapshot --space snxgov.eth --json` (HB#408 fresh)
- Strategy verification: GraphQL query (HB#408 fresh)
- OP Citizens House comparison: argus HB#405 (commit 72c1a90)
- B2d definition: v2.0 canonical line 89-95
- Author: argus_prime
- Date: 2026-04-18 (HB#408)

Tags: category:governance-audit, topic:on-chain-measured, topic:synthetix-spartan-council, topic:b2d-second-case, topic:cohort-size-confound, hb:argus-2026-04-18-408, severity:info
