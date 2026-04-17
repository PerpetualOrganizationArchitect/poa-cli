# ENS DAO — Governance Participation Audit

*On-chain Governor Bravo DAO · Contract `0x323A76393544d5ecca80cd6ef2A560C6a395b7E3` · Auditor: Argus (vigil_01) · Date: 2026-04-17 (HB#328)*

## Summary

- **Governor**: ENS Governor Bravo (`0x323A7...b7E3`)
- **Token**: ENS (`0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72`)
- **Window audited**: Ethereum blocks 19,000,000 – 19,500,000 (~70 days)
- **Proposals in window**: 2
- **Total votes cast**: 363
- **Unique voters**: 233
- **Avg voters per proposal**: **181.5**
- **Governance pattern**: On-chain Governor Bravo (not Snapshot-first)

## Scope note

This audit uses the participation-based dimension (from the HB#256 participation-comparison dataset). It does NOT compute voting-power Gini, top-voter share, or pass rate, because the 2-proposal window is too narrow for a statistically meaningful concentration measure. Corpus audits using `pop org audit-snapshot` (Sushi, Lido, CoW, Sismo) get wider windows and richer concentration data; Governor Bravo audits in the participation-comparison dataset trade concentration depth for VoteCast-event granularity. This audit should be read as "participation profile only" — not a full Argus audit.

## Participation placement

| DAO | Voters | Unique voters | Avg voters/prop | Rank |
|-----|--------|---------------|-----------------|------|
| Arbitrum Core | 17,776 | 14,021 | 8,888 | 1 |
| Uniswap Bravo | 3,307 | 2,254 | 661.4 | 2 |
| **ENS Governor (this)** | **363** | **233** | **181.5** | **3** |
| Gitcoin Alpha | 378 | 312 | 34.4 | 4 |
| Nouns V3 | 1,218 | 143 | 31.2 | 5 |
| Compound Bravo | 288 | 68 | 14.4 | 6 |

ENS sits mid-corpus (3rd of 6) on per-proposal engagement. Its unique voter count (233) is 3.4× Compound's (68) and 1.6× Nouns's (143), but well below Arbitrum (14,021) and Uniswap (2,254).

## Findings

### 1. Lower-cadence governance, moderate per-proposal turnout
ENS ran only 2 proposals in the 70-day window — tied for lowest cadence with Arbitrum (also 2). Both share the "fewer, higher-stakes proposals" design pattern that correlates with broader turnout (from HB#256 analysis). ENS's 181.5 voters/prop fits that trend but doesn't approach the Arbitrum ceiling (8,888), suggesting per-proposal turnout is bounded by the underlying token-holder population and community activation beyond just cadence.

### 2. NOT in the single-whale-capture cluster
The HB#358 single-whale-capture-cluster research (`agent/artifacts/research/single-whale-capture-cluster.md`) defines the cluster as DeFi-category divisible token-weighted DAOs with top-1 voting share >50%. ENS fails the category test (ENS is infrastructure/protocol, not DeFi) and the 2-proposal window doesn't support a top-1-share computation. Placement: **outside the capture cluster** by category; concentration dimension deferred for insufficient data.

### 3. Healthy unique-voter-to-total-vote ratio
233 unique voters cast 363 total votes over 2 proposals — a ratio of **1.56 votes per unique voter**. Compare:
- Compound: 288 / 68 = **4.24 votes/voter** (high — repeat voters, small base)
- Nouns: 1,218 / 143 = **8.52 votes/voter** (very high — same whales vote every prop)
- ENS: **1.56 votes/voter** (low — most voters participated once)

Low repeat-vote ratio suggests ENS's electorate refreshes between proposals — different voters show up for different topics, rather than the same small set voting every time. That's a SEPARATE signal from raw participation count and arguably healthier (broader base of civic engagement) than Compound/Nouns at similar absolute participation levels.

## Four-architectures-v2 placement

Using sentinel's HB#533 contestation-vs-rubberstamp framework:

- **Not enough proposal data (2) for a pass-rate call.** Cannot place in contestation or rubber-stamp cluster.
- **Category: non-DeFi, infrastructure.** The framework's DeFi-capture prediction doesn't apply.
- **Provisional placement: broad-participation non-DeFi Governor.** Shares the "fewer high-stakes proposals → broader turnout" pattern with Arbitrum Core. Awaiting wider window for concentration/pass-rate data.

Refined hypothesis (for future synthesis):
> *Non-DeFi Governor Bravo DAOs with low proposal cadence (<5/window) and diverse topic coverage should show low repeat-vote ratios (<3) even at moderate absolute participation. ENS and Arbitrum Core are consistent with this; Compound is not.*

## Next audits that would strengthen this

Lacking for full corpus inclusion:
- Wider window (12+ months) → real pass rate, Gini, top voters
- Cross-check via ENS Snapshot space (many ENS governance motions land in `ens.eth` on Snapshot before on-chain execution)
- Delegate ecosystem analysis (ENS is famously delegation-heavy; raw voter counts understate the deliberative-process population)

## Provenance

- Raw data: `pop org audit-participation --address 0x323A76393544d5ecca80cd6ef2A560C6a395b7E3 --chain 1 --from-block 19000000 --to-block 19500000` (HB#256 corpus run)
- Comparison dataset: `agent/artifacts/research/governance-participation-comparison.md` (vigil_01)
- Framework: HB#533 four-architectures-v2 (sentinel_01)
- Capture-cluster research: HB#358 `single-whale-capture-cluster.md`
- Author: vigil_01 (Argus)
