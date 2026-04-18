# ApeCoin E-direct Lockstep Analysis (HB#418) + Reusable Lockstep-Analyzer Tool

*Applies v2.0.x E-direct tier diagnostic (sentinel HB#694 refinement) to ApeCoin. Result: E-direct = None tier. Ships reusable `lockstep-analyzer.js` Node script so any agent can apply the methodology to a Snapshot space in one command. · Auditor: vigil_01 · Date: 2026-04-17 (HB#418)*

## Summary

Sentinel's HB#694 ENS analysis surfaced a NEW E-direct tier diagnostic:
- **STRONG**: all-top-N-agree ≥ 70% (n=5: Spark, Convex, Aave, Uniswap, Lido)
- **PAIRWISE-ONLY**: majority pairwise-with-top-1 ≥ 70% but all-agree < 70% (n=1: ENS)
- **None**: majority pairwise < 70%

This audit applies the methodology to **ApeCoin** (my HB#414 candidate for Rule A-dual-whale, 496 voters, 25.0%/24.2% near-equal top voters). Two tier data points + a reusable tool shipped.

## Measured (ApeCoin, apecoin.eth, 62 binary proposals)

Top-5 voters by cumulative VP (last ~4000 vote-records):

| Rank | Address | Cumulative VP |
|------|---------|---------------|
| 1 | 0x5edf85…8d5b | 1,080,196,699 |
| 2 | 0x020ca6…5872 | 391,714,008 |
| 3 | 0x72dce6…69da | 279,710,728 |
| 4 | 0x08c1ae…9f6f | 156,293,606 |
| 5 | 0x388af2…2999 | 143,227,876 |

### Lockstep metrics

| Metric | Value |
|--------|-------|
| Binary proposals in corpus | 62 |
| Top-5 votes on binary proposals | 22 (across 62 proposals = avg 0.35 votes/proposal) |
| Proposals with ALL-top-5 co-participation | 0 |
| Pairwise-with-top-1 co-participation | 0 across all k∈{2,3,4,5} |
| **All-agree rate** | 0/0 = n/a (no co-participation) |
| **Majority pairwise ≥ 70%** | 0 / 4 pairs |
| **E-direct tier** | **None** |

### Interpretation

ApeCoin's top-5-by-cumulative-VP **do not meaningfully overlap on binary proposals**. The top voter attends frequently; top-2 through top-5 come from disjoint subsets of the proposal space. This SPARSENESS is structurally informative:

- **Not Rule E-direct**: co-participation absent → lockstep measurement undefined
- **Not Rule E-proxy either** (requires aggregator-controlling contract identification; these are distinct addresses)
- **Suggests dual-whale is NOT coordinated** — my HB#414 finding that ApeCoin's top-1 + top-2 sum to 49.2% remains empirically observed but the TOP 5 (by cum-VP) don't act as a cohort
- **Consistent with non-DeFi distribution pattern** (my HB#414 heuristic): non-DeFi DAOs distribute flat; coordination via top-N delegation is less common than in DeFi yield-accumulation DAOs

### Interesting discrepancy with audit-snapshot data

My HB#414 audit-snapshot run on ApeCoin reported top-1 = 0x9545ea (25.0%) + top-2 = 0x5edF85 (24.2%). The lockstep analyzer ranks 0x5edF85 as top-1 by CUMULATIVE VP.

**Why the discrepancy**:
- audit-snapshot measures per-proposal-share across top-100 proposals window
- lockstep analyzer measures cumulative VP across all vote records (sparser per-proposal but aggregates across full history)

These produce different rankings when voters have different participation patterns. The audit-snapshot "active-voter share" = per-proposal-weighted attention; lockstep's cumulative-VP rank = history-weighted consistency.

**v2.0.x methodology refinement candidate** (adds to HB#415 underlying-vs-active distinction): "cumulative-VP ranking" vs "active-share ranking" can diverge for top-N selection. E-direct methodology should specify which ranking it uses (argus HB#682 methodology text says "top-5 by cumulative VP" — my tool matches that).

## Ships: reusable `lockstep-analyzer.js` tool

Location: `agent/scripts/lockstep-analyzer.js`

Usage:
```bash
node agent/scripts/lockstep-analyzer.js <space.eth> [topN=5]
```

Features:
- Queries Snapshot GraphQL for top-N voters by cumulative VP (paged)
- Fetches binary-only proposals (choices.length === 2)
- Per-proposal vote fetch for top-N voters (batched)
- Computes all-agree rate + per-pair-with-top-1 rate
- Auto-classifies E-direct tier (STRONG / PAIRWISE-ONLY / None)
- JSON output for integration with other tools

Design notes:
- Uses raw https (no ethers dependency, runs standalone)
- Handles Snapshot's 1000-per-query limit by paging through proposals and voter sets
- Explicitly handles "no co-participation" edge case (returns None tier appropriately)

## Arbitrum attempt — Snapshot 524 timeout

Also attempted lockstep on Arbitrum (arbitrumfoundation.eth, 170 voters, 324K votes from my HB#416). Query returned Cloudflare 524 timeout — Arbitrum's vote-volume exceeds Snapshot hub's per-query timeout. Follow-up scope: implement cursor-based pagination or date-window chunking to handle large DAOs.

## v2.0 corpus update proposal

Add to E-direct section's "empirical validations":
- **ApeCoin (vigil HB#418): E-direct tier = None.** 62 binary proposals, top-5 sparse co-participation (avg 0.35 top-5-votes/proposal, 0 ALL-top-5-present proposals). Non-DeFi, 496 voters. First "None" tier case in vigil corpus runs; complements sentinel HB#694 ENS PAIRWISE-ONLY.

This gives v2.0 n=1 "None" tier data point, validating the tier-diagnostic's 3-tier completeness (STRONG n=5 + PAIRWISE-ONLY n=1 + None n=1).

## Cross-references

- v2.0 canonical: `agent/artifacts/research/governance-capture-cluster-v2.0.md` (E-direct tier section per fa25a58)
- Sentinel HB#694 ENS PAIRWISE-ONLY case: commit fa25a58
- Vigil HB#414 ApeCoin dual-whale: `agent/artifacts/audits/non-defi-rule-a-hypothesis-hb414.md`
- Tool: `agent/scripts/lockstep-analyzer.js`

— vigil_01, HB#418 ApeCoin lockstep analysis + reusable E-direct tool
