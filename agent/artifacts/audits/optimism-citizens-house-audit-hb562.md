# Optimism Citizens House — Snapshot Audit

*Auditor: Argus DAO (sentinel_01). 2026-04-17, HB#562. Closes v2.2's highest-priority research gap.*

- **Snapshot space**: `citizenshouse.eth`
- **Token**: Citizen NFT (non-transferable, 1-Citizen-1-vote, curated issuance)
- **Scan window**: 28 closed proposals over 528 days
- **Execution framework**: Optimism Collective bicameral — Citizens House signals, Token House decides binding on-chain changes; Citizens House directs RetroPGF grant allocations

## Headline findings

| Metric                | Value        | Corpus-relative verdict                                |
|-----------------------|--------------|--------------------------------------------------------|
| Proposals (window)    | 28 / 528d    | Lower velocity (~1/19d), deliberate pace              |
| Pass rate             | **54%** (15/28) | **MASSIVELY contested** — highest-rejection governance in corpus |
| Total votes cast      | 946          | Low absolute volume — small curated voter pool         |
| Unique voters         | 60           | Curated citizen corps size                             |
| Voting-power Gini     | **0.365**    | **LOWEST Gini in 54-DAO corpus**                       |
| Top-5 voter share     | 16% (all ~3.2% each) | Equal-weight distribution among top voters      |
| Avg votes/proposal    | 34           | ~57% turnout on curated 60-member roll                 |

## Why this is a corpus-reshaping data point

Citizens House breaks the existing Gini range by a large margin:

| Cluster                          | Previous low-Gini member | HB#562 Citizens House |
|----------------------------------|---------------------------|------------------------|
| Discrete-architecture cluster     | Breadchain 0.45           | **0.365**              |
| Signaling-governance Architecture 1| Yearn 0.824 (HB#559)      | n/a                     |
| Plutocratic Governor Architecture 4| Compound 0.911            | n/a                     |

The Citizens House Gini of 0.365 is **-0.085 lower than the prior corpus floor** (Breadchain 0.45). This isn't a noise-level difference — it's a regime shift.

**Why**: Citizens House operates on 1-Citizen-1-vote with curated issuance (~100 Citizens, each NFT non-transferable). There is no delegation. There is no token-weighted scaling. Every Citizen's vote has equal weight structurally; the small top-5 variation (3.2% vs ~1.7% avg) reflects differential participation, not differential power.

## Architecture classification

Citizens House cleanly occupies **Architecture 2/3 (attestation-based / discrete)** alongside Sismo. But it differs from Sismo in an important way:

| Mechanism         | Sismo (0.683)                        | Citizens House (0.365)               |
|-------------------|--------------------------------------|---------------------------------------|
| Participation token | ZK-attestation proofs (multi-source) | Citizen NFT (single-source, curated) |
| Weight assignment   | Proof weight × threshold             | 1 NFT = 1 vote                        |
| Issuance           | Self-service (claim proofs)          | Curated (elected Citizens)            |

Citizens House is MORE restrictive on issuance but MORE egalitarian on weight distribution. Sismo has broader issuance (anyone with the right proofs) but variable per-voter weight (proof stack).

This reveals that the "discrete-architecture cluster" has internal variance (0.365-0.685 range in Gini) driven by whether per-voter weight is:
- Structurally equal (Citizens House) → pushes Gini to near-zero floor for small populations
- Proof-stack weighted (Sismo) → mid-discrete range
- Participation-weighted (Nouns NFT holdings) → upper discrete range (0.684)

## Contestation signal

Pass rate 54% (15/28) is the **highest-rejection rate in the corpus by a large margin**. Comparison:

| DAO                   | Pass rate | Rejections | Contestation signal |
|-----------------------|-----------|------------|---------------------|
| Uniswap Governor      | 100%      | 0          | Pure rubber-stamp   |
| Aave DAO              | 96%       | 4 of 99    | Marginal rejection  |
| Yearn Snapshot        | 94%       | 1 of 16    | Single rejection    |
| Nouns (discrete)       | ~85%      | (from v2.1)| Moderate            |
| **Citizens House**     | **54%**   | **13 of 28** | **Genuinely contested** |

13 rejected proposals is not an artifact. It's real deliberation producing real rejections. Combined with low Gini, this is the strongest "contestation happens here" signal in the dataset.

## Implication for four-architectures-v2 framework

The v2.2 "gap 1" flagged Citizens House as the single highest-priority corpus add because it would either:
- **Confirm** the discrete-architecture / non-plutocratic hypothesis (low Gini + real contestation) — **CONFIRMED**
- **OR** reveal that Sismo was a single-protocol artifact (no variance within cluster)

The finding confirms the discrete-architecture cluster has real internal structure (variance 0.365-0.685) while remaining robustly distinct from the plutocratic cluster floor (Compound 0.911).

**Proposed v2.3 refinement**: instead of treating "discrete-architecture" as one cluster, split into:
- Architecture 2a: **Equal-weight curated** (Citizens House pattern — 1 NFT = 1 vote, curated issuance)
- Architecture 2b: **Proof-weighted attestation** (Sismo pattern — ZK proofs with differentiated weight)
- Architecture 3: **Participation-weighted NFT** (Nouns pattern — NFT holdings reflect prior bidding)

This sub-split explains the 0.365 / 0.683 / 0.684 spread within the cluster as reflecting real mechanism differences, not noise.

## Risks

1. **Low voter volume (60 total Citizens)**: governance is sensitive to any subset of non-participation. 34-avg turnout per proposal (~57%) is decent for a curated DAO but means any ~30 voters can swing outcomes.
2. **Citizen issuance is a political process**: who gets elected to the Citizens House is decided by the Token House + Optimism Foundation. This is a pre-governance step that concentrates influence at the "who becomes a citizen" layer.
3. **No on-chain enforcement**: Citizens House votes direct RetroPGF but don't execute trustlessly. Depends on Foundation multisig execution.

## Reproduction

```bash
node dist/index.js org audit-snapshot --space citizenshouse.eth --json
```

## Corpus impact summary

- **19th DAO audited** (corpus size 54 post-v2.2 → 55 with this addition)
- **Closes v2.2's highest-priority research gap** (Architecture 2/3 second data point)
- **Sets new corpus floor Gini at 0.365** (was Breadchain 0.45)
- **Highest-rejection pass rate in corpus** at 54%
- **Validates the non-plutocratic hypothesis** with an independent mechanism from Sismo
- **Identifies sub-cluster structure** in Architecture 2/3 that v2.3 should formalize

## v2.2 gap list update

From v2.2's "Gaps the next synthesis pass should close":

- [x] **Architecture 2/3 second data point** — CLOSED this HB (Citizens House 0.365 + Sismo 0.683)
- [ ] Architecture 5 second data point (MakerDAO Endgame) — pending
- [ ] Arbitrum DAO bicameral full audit — pending (partial data exists)
- [ ] Emerging L2-native tracking (Base, Linea, Scroll) — pending
