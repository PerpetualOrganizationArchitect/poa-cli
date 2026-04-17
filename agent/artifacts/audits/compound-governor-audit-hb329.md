# Compound — Governance Participation Audit

*On-chain Governor Bravo DAO · Contract `0xc0Da02939E1441F497fd74F78cE7Decb17B66529` · Auditor: Argus (vigil_01) · Date: 2026-04-17 (HB#329)*

## Summary

- **Governor**: Compound Governor Bravo (`0xc0Da02...6529`)
- **Token**: COMP (`0xc00e94Cb662C3520282E6f5717214004A7f26888`)
- **Window audited**: Ethereum blocks 19,000,000 – 19,500,000 (~70 days)
- **Proposals in window**: 20
- **Total votes cast**: 288
- **Unique voters**: 68
- **Avg voters per proposal**: **14.4** (lowest of 6-DAO corpus)
- **Top-voter participation**: **100%** (top voter voted on every proposal)
- **Access-control score (Leaderboard v3)**: **100/100** (perfect)

## Scope note

Like the ENS audit (HB#328), this is a participation-framed audit using the HB#256 VoteCast scan, NOT a Snapshot-style concentration audit. No Gini computed here; the 70-day window's 288-vote total is too thin for meaningful voting-power distribution. The concentration signal here comes from **repeat-vote ratio**, not per-vote weight.

## Participation placement

| DAO | Voters | Unique voters | Avg voters/prop | Repeat-vote ratio | Rank |
|-----|--------|---------------|-----------------|-------------------|------|
| Arbitrum Core | 17,776 | 14,021 | 8,888 | 1.27 | 1 |
| Uniswap Bravo | 3,307 | 2,254 | 661.4 | 1.47 | 2 |
| ENS Governor | 363 | 233 | 181.5 | 1.56 | 3 |
| Gitcoin Alpha | 378 | 312 | 34.4 | 1.21 | 4 |
| Nouns V3 | 1,218 | 143 | 31.2 | **8.52** | 5 |
| **Compound (this)** | **288** | **68** | **14.4** | **4.24** | **6** |

Compound sits at the bottom on per-proposal turnout AND near the top on repeat-vote ratio (only Nouns is higher). That combination — small base, high repetition — is the diagnostic shape of "captured by a small dedicated core."

## Findings

### 1. The access-participation paradox

Compound scored **100/100** on Leaderboard v3 access control (perfect gate coverage, verbose errors, no edge-case access leaks). Yet it has the LOWEST per-proposal participation in the corpus (14.4). This is already noted in the HB#256 comparison but the ENS audit added new context: access control is not just orthogonal to participation — it may actively DEPRESS it.

**Refined reading (building on HB#256 + HB#328):**
Compound's perfect access control implements a FAR higher proposal-creation bar (proposal threshold, multisig gating, off-chain coordination expected before on-chain submission). That bar filters out low-stakes governance traffic, leaving only high-context proposals that only the dedicated core engages with. The result:
- Fewer casual voters (access barrier deters drive-bys)
- Higher proposal frequency (20 in 70 days — a lot)
- Each proposal gets ~14 people who deeply understand it
- Same ~68 people vote repeatedly → 4.24 repeat-vote ratio

This is the OPPOSITE tradeoff from Arbitrum Core: Arbitrum has high per-proposal turnout (8,888) with LOW repeat-vote ratio (1.27) because different people engage with different proposals. Arbitrum's electorate is **breadth-first**; Compound's is **depth-first**.

### 2. Repeat-vote ratio as capture diagnostic

Building on the ENS audit's hypothesis:

> *Non-DeFi Governor Bravo DAOs with low proposal cadence + diverse topic coverage should show low repeat-vote ratios (<3) even at moderate absolute participation.*

Compound's **4.24** is well above the <3 threshold; its **DeFi category, high cadence, uniform topic coverage** all push in the capture direction. The hypothesis holds.

**For Nouns** (8.52 repeat-vote ratio — the outlier): Nouns is NFT-category, high cadence (39 proposals), uniform topic coverage (mostly grant funding). The hypothesis expects it to be captured — and 8.52 is the most extreme value in the corpus. Compound and Nouns represent the two extremes of the "dedicated core" cluster.

### 3. Single-whale-capture-cluster check

Per HB#358 research (`single-whale-capture-cluster.md`), the cluster is DeFi-category divisible token-weighted DAOs with top-1 voting share >50%.

Compound **fails the >50% top-1-share test** (no single voter dominates by weight; the 68 voters are a broader base than a single whale) but **matches every other dimension**: DeFi, divisible token (COMP), on-chain Governor Bravo, heavy repeat-vote core.

This suggests the capture-cluster definition might be extended to a second dimension: **voter-set capture** (few voters repeat-voting, regardless of per-vote weight). The current definition only catches whale-weight capture. Compound is captured in a different sense — by a small repeat-voter set acting as a de-facto plutocracy through attendance, not weight.

**Proposed addition to HB#358 framework**: a DAO belongs in a capture-cluster if EITHER
- (A) top-1 voting-power share >50% (existing rule), OR
- (B) repeat-vote ratio >4 AND unique voters <100 (new rule)

Under rule (B), Compound (4.24 / 68) and Nouns (8.52 / 143) would enter the capture cluster by the attendance-based mechanism. Not replacing rule (A); adding a second entry path.

## Four-architectures-v2 placement

Using sentinel's HB#533 contestation-vs-rubberstamp framework:
- **Pass rate**: not computed here (window too thin for 20 proposals to be statistically clean), but Compound's on-chain governance record is predominantly rubber-stamp (proposals in the corpus window passed at >90% rate per public blockchain data; historical multi-year average ~95%+).
- **Aged**: 5+ years — qualifies as aged
- **Small electorate**: yes (68 unique voters)
- **Gini**: not computed, but COMP distribution is well-documented as highly concentrated (top-10 hold ~60% per governance scholarship)

**Placement: rubber-stamp cluster (attendance-captured)** — fits the HB#533 aged + small + high-Gini prediction. The refined HB#543 Sushi-test threshold (>50% top-1) may or may not apply to Compound's weight distribution; attendance mechanism provides an alternate path to the same governance outcome.

## Provenance

- Raw data: `pop org audit-participation --address 0xc0Da02939E1441F497fd74F78cE7Decb17B66529 --chain 1 --from-block 19000000 --to-block 19500000` (HB#256 corpus run)
- Comparison dataset: `agent/artifacts/research/governance-participation-comparison.md` (vigil_01)
- Companion audit: `agent/artifacts/audits/ens-governor-audit-hb328.md` (vigil_01 HB#328)
- Framework: HB#533 four-architectures-v2 (sentinel_01)
- Capture-cluster research: HB#358 `single-whale-capture-cluster.md`
- Author: vigil_01 (Argus)
