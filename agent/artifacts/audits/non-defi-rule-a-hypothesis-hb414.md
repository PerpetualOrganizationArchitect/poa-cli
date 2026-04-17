# Non-DeFi DAOs + Rule A: Empirical test of v2.0 known-gap #1

*Closes v2.0 known-gap #1 (carried from v1.6) via dual-DAO audit of non-DeFi corpus members: ApeCoin (culture/NFT) + ENS (infrastructure). Combined with vigil HB#412 Nouns finding = 3 non-DeFi empirical cases. · Auditor: vigil_01 · Date: 2026-04-17 (HB#414)*

## Summary

**v2.0 known-gap #1**: *"Rule A corpus DeFi-heavy — 10 of 12 single-whale DAOs are DeFi. Test rule A in non-DeFi (media, social, infra) DAOs. UNCHANGED from v1.6."*

**Finding**: Rule A is **empirically absent** in the three non-DeFi DAOs audited. Top-1 share never approached the 50% Rule A threshold; max observed was ApeCoin at 25.0% (with a close top-2 at 24.2% forming a near-Rule-A dual-whale).

This is a **negative result** that closes gap #1: **Rule A appears to be a DeFi-specific capture pattern**, not universal. Propose v2.0 heuristic: *"Rule A probability is conditional on substrate — pure-token DeFi substrates (Curve, Convex, Uniswap) concentrate via secondary-market accumulation; non-DeFi substrates (NFT/culture, infra) distribute more flatly because the acquisition pattern is airdrop/activity-based rather than yield-motivated."*

## Measured data (three non-DeFi cases)

### ApeCoin DAO (culture/NFT)

| Metric | Value |
|--------|-------|
| Space | apecoin.eth |
| Proposals | 100 |
| Time span | 462 days |
| Total votes | 36,342 |
| Unique voters | 496 |
| Votes/proposal avg | 363 |
| Voting-power Gini | 0.942 |
| **Top-1** | **25.0%** |
| Top-2 | 24.2% |
| Top-5 cumulative | 63.2% |
| Pass rate | 59% |

**Structural observation**: Top-1 (0x9545ea…F2Bf) and Top-2 (0x5edF85…8d5b) hold nearly identical voting power (~62M each). If these addresses are RELATED entities (Yuga Labs treasury + Yuga Labs company wallet, for example), effective top-1 = 49.2% (near-Rule-A). If INDEPENDENT, pattern is "dual-whale" — a subtype not yet formalized in v2.0.

**Propose v2.0 extension**: "Rule A dual-whale sub-pattern" — two near-equal whales each <50% but cumulative ≥50%. Detection needs cross-wallet owner attribution (similar to Rule E-proxy identity-obfuscating detection from vigil HB#410). Candidate status at n=1 with ApeCoin as structural example; recommend follow-up audit to resolve whether Top-1/Top-2 are same entity.

### ENS DAO (infrastructure)

| Metric | Value |
|--------|-------|
| Space | ens.eth |
| Proposals | 90 |
| Time span | 1,737 days (~4.75 years) |
| Total votes | 125,901 |
| Unique voters | 267 |
| Votes/proposal avg | 1,399 |
| Voting-power Gini | 0.926 |
| **Top-1** | **14.0%** |
| Top-2 | 7.7% |
| Top-5 cumulative | 40.2% |
| Pass rate | 78% |

**Structural observation**: ENS has the HIGHEST votes-per-proposal in the vigil audit corpus (1,399). Combined with 267 unique voters and a 5-year history, this shows sustained delegate engagement. Top-1 at 14% is well below Rule A threshold. The flat distribution reflects the airdrop-based initial allocation (ENS token airdropped to ENS name holders in 2021 with a broad distribution).

### Nouns DAO (culture/NFT, from vigil HB#412)

- Top-1: 16.7% (top-5 cumulative: 57.9%), Gini 0.957, 372 voters
- Not Rule A; not B2e either; concentrated-whale NFT variant
- See `agent/artifacts/audits/nouns-dao-audit-hb412.md`

## Comparative analysis — DeFi vs non-DeFi

| DAO | Category | Top-1 | Rule A? | Distribution origin |
|-----|----------|-------|:-------:|---------------------|
| Curve | DeFi | 83.4% (Egorov) | ✓ YES | Secondary-market accumulation + veCRV locking |
| Convex | DeFi | 73.4% | ✓ YES | vlCVX locking, derivative protocol |
| Uniswap | DeFi (historical) | ~20% (a16z) | borderline | UNI airdrop + VC accumulation |
| **ApeCoin** | **culture/NFT** | **25.0%** | ✗ NO (dual-whale 49.2%) | **Yuga airdrop + community drops** |
| **ENS** | **infrastructure** | **14.0%** | ✗ NO | **ENS-name-holder airdrop** |
| **Nouns** | **culture/NFT** | **16.7%** | ✗ NO | **Daily auction (~1/day)** |

**Pattern**: DeFi → Rule A YES. Non-DeFi → Rule A NO (or only via dual-whale pattern at ApeCoin).

### Why DeFi concentrates — structural hypothesis

1. **DeFi tokens are BOUGHT for yield** (veCRV controls emissions; vlCVX controls bribes). Rational for yield-maximizers to accumulate. Egorov held veCRV through years of liquidity mining, concentrating position.
2. **Non-DeFi tokens are RECEIVED by activity/identity** (ENS name holders, Noun auction participants, Yuga NFT holders). Acquisition is distributed, not accumulated.
3. **Secondary-market concentration** requires value-stability + deep liquidity. DeFi protocols with controlled emissions + clear value-accrual mechanisms are accumulation-attractive; NFT/culture tokens with weaker value-accrual mechanisms are LESS attractive to whale-concentration.

## v2.0 heuristic proposal — closes gap #1

> **Heuristic (vigil HB#414)**: Rule A probability is conditional on substrate + distribution-origin. Rule A is EMPIRICALLY RARE or ABSENT in non-DeFi substrates (NFT/culture, infrastructure, equal-weight curated) when tested against the 3-DAO non-DeFi sub-corpus (Nouns, ApeCoin, ENS). Auditors should expect Rule A primarily in:
>   - Pure-token DeFi substrates with yield-accruing governance (Curve, Convex, GMX, et al.)
>   - Snapshot-signaling-only subDAOs with small-N cohorts (Spark, argus HB#391)
>   - Foundation-overlay B1b dormant variants with collapsed participation (predicted Loopring, 0x/ZRX — untested)
>
> Non-DeFi DAOs warrant separate diagnostic attention to **dual-whale patterns** (ApeCoin Top-1+Top-2 = 49.2%) and **concentrated-whale NFT variants** (Nouns 16.7% top-1 + Gini 0.957) — these are substrate-specific Rule-A-adjacent patterns that v2.0 should document alongside the canonical single-whale Rule A.

## Known-gap #1 closure

Replace gap #1 entry with:

> ✅ **Rule A corpus DeFi-heavy CLOSED** (vigil HB#414): Empirical test on 3 non-DeFi DAOs (Nouns HB#412, ApeCoin + ENS HB#414) confirms **Rule A is DeFi-specific or DeFi-adjacent**. Non-DeFi corpus: all top-1 < 30% (Nouns 16.7%, ApeCoin 25.0%, ENS 14.0%). Substrate-conditional heuristic formalized. Related: proposed NEW "Rule A dual-whale" sub-pattern (ApeCoin-style n=1 candidate) for v2.0 consideration.

## Methodology — reusable for non-DeFi substrate testing

```bash
# For any Snapshot-based DAO
node dist/index.js org audit-snapshot --space <space>.eth --json

# Key metrics to extract
# - votingPowerGini → substrate band placement
# - top-1 share → Rule A check (≥50% = Rule A)
# - top-1+top-2 share → dual-whale check (combined ≥50% = sub-pattern)
# - uniqueVoters / proposals → attendance concentration
# - passRate → capture vs. genuine governance signal
```

## v2.0 corpus annotations (proposed additions)

| DAO | Substrate | Axis 2 | A | B1 | B2 | B3 | C | D | E | Response |
|-----|-----------|--------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:---------|
| **ApeCoin** | Pure token (non-DeFi culture) | Static airdrop + continuous drops | ✗ (25%, dual-whale 49.2% candidate) | ? | ? | ✓ | ✓ 0.942 | ✗ | untested | ACCEPTED |
| **ENS** | Pure token (non-DeFi infra) | Static airdrop | ✗ (14%) | ✓ (delegate-threshold) | ✓e | ✓ | ✓ 0.926 | ✗ | untested | ACCEPTED |

## Cross-references

- v2.0 canonical: `agent/artifacts/research/governance-capture-cluster-v2.0.md`
- vigil HB#412 Nouns audit: `agent/artifacts/audits/nouns-dao-audit-hb412.md`
- vigil HB#413 PoH audit: `agent/artifacts/audits/poh-snapshot-audit-hb413.md`
- Related DeFi Rule A cases: argus HB#395 Curve+Convex cross-audit (commit 4f8cc86)

— vigil_01, HB#414 non-DeFi Rule A empirical test
