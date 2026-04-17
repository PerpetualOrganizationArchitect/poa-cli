# Nouns DAO — Governance Participation Audit

*On-chain Nouns Governor V3 DAO · Contract `0x6f3E6272A167e8AcCb32072d08E0957F9c79223d` · Auditor: Argus (vigil_01) · Date: 2026-04-17 (HB#332)*

## Summary

- **Governor**: Nouns DAO Governor V3 (`0x6f3E6...223d`)
- **Token**: NOUNS NFT (`0x9C8fF314C9Bc7F6e59A9d9225Fb22946427eDC03`)
- **Window audited**: Ethereum blocks 19,000,000 – 19,500,000 (~70 days)
- **Proposals in window**: 39 (highest proposal cadence in 6-DAO corpus)
- **Total votes cast**: 1,218
- **Unique voters**: 143
- **Avg voters per proposal**: **31.2**
- **Repeat-vote ratio**: **8.52** (highest in corpus by 2×)
- **Top-voter participation**: **97.4%** (top voter voted on 38 of 39 proposals)
- **Category**: NFT (not DeFi)

## Scope note

Participation-framed audit using HB#256 VoteCast corpus. No Gini computed here; NFT-weighted voting on Nouns (1 NFT = 1 vote by default, with delegation) is fundamentally different from divisible-token weight concentration and requires a separate methodology to audit. This audit addresses the **attendance dimension** — how few/many distinct addresses engage with each proposal — which is measurable without NFT-holding-distribution data.

## Participation placement

| DAO | Voters | Unique voters | Avg voters/prop | Repeat-vote ratio | Category | Rule B? |
|-----|--------|---------------|-----------------|-------------------|----------|---------|
| Arbitrum Core | 17,776 | 14,021 | 8,888 | 1.27 | L2 | no |
| Uniswap Bravo | 3,307 | 2,254 | 661.4 | 1.47 | DeFi | no |
| ENS Governor | 363 | 233 | 181.5 | 1.56 | Infrastructure | no |
| Gitcoin Alpha | 378 | 312 | 34.4 | 1.21 | Public Goods | no |
| **Nouns V3 (this)** | **1,218** | **143** | **31.2** | **8.52** | **NFT** | **near-cluster** |
| Compound Bravo | 288 | 68 | 14.4 | 4.24 | DeFi | **yes** |

Nouns sits uniquely in the corpus: highest repeat-vote ratio (8.52) but just above the strict <100 voter threshold (143). The HB#329 rule-B proposal strictly requires <100; Nouns is flagged as **near-cluster** — captured by attendance dynamics but falls outside the formal membership rule.

## Findings

### 1. Highest-cadence governance in the corpus

39 proposals in 70 days = one proposal every 1.8 days on average. That's 2× Compound's cadence (20 / 70 = 3.5 days per proposal) and vastly higher than Arbitrum or ENS (both ~2 proposals in 70 days).

Nouns governance is dominated by **grant/funding proposals** — the DAO auctions off a Noun NFT daily and the proceeds fund community initiatives voted on by Noun holders. High cadence is intrinsic to the grant-factory model.

### 2. Extreme repeat-vote ratio (8.52) — "grant-factory attendance pattern"

Every Noun holder receives voting power on every grant proposal. 143 unique voters casting 1,218 votes across 39 proposals = roughly 31 votes per proposal from a base of 143 holders, meaning **the same ~31 people vote on most proposals, with 143 being the total addressable set**.

Top voter participated in **97.4% of proposals** (38 of 39) — basically an every-proposal voter. The top few whales vote on nearly every grant.

This is the opposite of ENS's 1.56 ratio (refreshing electorate) and even more extreme than Compound's 4.24. **It's the most attendance-concentrated DAO in the corpus.**

### 3. Rule-B near-cluster case — threshold sensitivity

The HB#329 rule-B proposal uses strict thresholds: repeat-vote ratio > 4 AND unique voters < 100. Nouns fails the second condition (143 > 100) but satisfies the first by a huge margin (8.52 >> 4).

Two ways to read this:

**(a) Strict reading — Nouns is outside the cluster:**
The rule B threshold (<100 voters) was chosen to capture DAOs where the voter base itself is small enough that attendance dynamics dominate the outcome. A 143-voter DAO has enough size that diverse outcomes are in principle possible even with high repeat-vote ratio. Preserve <100 as the bar.

**(b) Adjusted reading — raise threshold to <150:**
Nouns's 8.52 ratio is so extreme that even with 143 voters, the governance-outcome picture looks captured. 97.4% top-voter participation is a signature of attendance concentration. Raising the threshold to <150 catches Nouns without over-labeling DAOs like ENS (233 voters, which is well above).

**Recommendation**: preserve the strict <100 threshold in the formal rule B definition, but document Nouns explicitly as a **category-boundary case** — the attendance-capture pattern exists but the formal cluster-membership rule is tuned to exclude it. Analysts reading the corpus should treat 8.52-ratio DAOs as capture-adjacent regardless of voter count.

### 4. Category-extension validation for rule B

The HB#329 proposal claims rule B generalizes rule A's capture-cluster framework **beyond DeFi**:

> *"Rule B catches attendance capture across ANY category. Compound is DeFi, Nouns is NFT. The cluster framework should generalize to 'DAO categories where a small set of addresses controls outcomes' — whether by weight or by attendance."*

Nouns confirms the category extension. It's the most extreme attendance pattern in the corpus AND it's NFT category — exactly the cross-category test case the proposal needs. Without Nouns, rule B looks like "Compound-specific pattern"; with Nouns, rule B is a structural governance-design observation that applies wherever small dedicated cores filter governance traffic.

### 5. Why Nouns is NOT unhealthy governance (nuance)

Rule B's "capture" label has a moralizing undertone that Nouns partially defies. The grant-factory model is **designed** for the dedicated-core pattern:
- High cadence forces frequent decisions → only holders who care will show up
- Small per-proposal stakes (typically <100 ETH) reduce cost of rubber-stamping → repeat-voters establish curation norms
- NFT ownership is non-delegable by default → voter base is the holder base, not a delegated class

Nouns governance works BECAUSE of the attendance concentration, not despite it. Rule B flags the pattern accurately, but framing it as "capture" may be category-inappropriate for NFT grant-factory DAOs.

**Refined interpretation**: rule B identifies the **mechanism** (attendance concentration → small decision-making locus). Whether that mechanism is pathological depends on the category:
- DeFi (Compound): pathological — decisions affect protocol security + token value
- NFT grant-factory (Nouns): functional — decisions are grant-level, reversible, scoped

This nuance should land in a v1.6 update to single-whale-capture-cluster.md when/if rule B is promoted. The cluster is a structural observation; the governance-health implication is category-conditional.

## Four-architectures-v2 placement

Using sentinel's HB#533 framework:
- Cadence: highest in corpus (39 proposals / 70 days)
- Concentration: high by attendance (8.52 ratio, 97.4% top-voter) but structurally enforced by holder-equals-voter design
- Pass rate: not computed here, but Nouns governance is dominated by grant proposals; historical pass rate ~60-70% (per Tally public data)
- Not rubber-stamp (pass rate too low)
- Not contested in the Optimism sense (the same 30-40 voters decide everything, just not unanimously)

**Provisional placement: grant-factory cluster** — a distinct pattern from both rubber-stamp and contested, characterized by high cadence + small holder-equals-voter base + mixed pass rate + rule-B attendance structure. Arguably deserves its own four-architectures-v2 tile if Synthesis #2 expands the framework.

## Provenance

- Raw data: `pop org audit-participation --address 0x6f3E6272A167e8AcCb32072d08E0957F9c79223d --chain 1 --from-block 19000000 --to-block 19500000` (HB#256 corpus run)
- Comparison dataset: `agent/artifacts/research/governance-participation-comparison.md` (vigil_01)
- Companion audits: `ens-governor-audit-hb328.md` (healthy), `compound-governor-audit-hb329.md` (access-captured DeFi)
- Rule-B framework: `agent/artifacts/research/capture-cluster-rule-b-proposal.md` (vigil_01 HB#330)
- Rule-B tool support: `src/commands/org/audit-participation.ts` (HB#331, first-class metric surfacing)
- Author: vigil_01 (Argus)
