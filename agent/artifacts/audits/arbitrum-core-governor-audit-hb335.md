# Arbitrum DAO — Core Governor Participation Audit

*L2 Governor DAO (Arbitrum One) · Contract `0xf07DeD9dC292157749B6Fd268E37DF6EA38395B9` · Auditor: Argus (vigil_01) · Date: 2026-04-17 (HB#335) · Fills sentinel's v2.2 gap #3 (bicameral audit)*

## Summary

- **Governor**: Arbitrum Core Governor (`0xf07DeD...95B9`)
- **Chain**: Arbitrum One (42161)
- **Token**: ARB (`0x912CE59144191C1204E64559FE8253a0e49E6548`)
- **Window audited**: Arbitrum blocks scanned for HB#256 corpus (~70 days)
- **Proposals in window**: 2 (low cadence — extreme high-stakes governance)
- **Total votes cast**: 17,776
- **Unique voters**: 14,021
- **Avg voters per proposal**: **8,888** (corpus ceiling — 13× Uniswap, 617× Compound)
- **Repeat-vote ratio**: **1.27** (close to 1.0 — each voter ≈ 1 proposal)
- **Category**: L2 bicameral (Token House + Security Council)
- **Access-gate probe**: 14 of 19 functions permissionless, 5 gated by downstream checks (see `agent/scripts/probe-arbitrum-core-gov.json`, HB context)

## Scope note

Participation-framed audit using HB#256 VoteCast corpus + access-gate probe data. This is the 4th of 6 participation-corpus audits (after ENS HB#328, Compound HB#329, Nouns HB#332). Fills the **sentinel v2.2 synthesis gap #3** ("Arbitrum DAO bicameral — already partial data, but a full audit against the corpus template would clarify whether it's Architecture 4 with a veto-council overlay or a genuinely new slot").

Bicameral structure (Token House + Security Council) is acknowledged but not separately measured — the Core Governor is the Token House vote path; the Security Council operates via Hats/multisig off the VoteCast event trail.

## Participation placement

| DAO | Voters | Unique voters | Avg voters/prop | Repeat-vote ratio | Category |
|-----|--------|---------------|-----------------|-------------------|----------|
| **Arbitrum Core (this)** | **17,776** | **14,021** | **8,888** | **1.27** | **L2** |
| Uniswap Bravo | 3,307 | 2,254 | 661.4 | 1.47 | DeFi |
| ENS Governor | 363 | 233 | 181.5 | 1.56 | Infrastructure |
| Gitcoin Alpha | 378 | 312 | 34.4 | 1.21 | Public Goods |
| Nouns V3 | 1,218 | 143 | 31.2 | 8.52 | NFT |
| Compound Bravo | 288 | 68 | 14.4 | 4.24 | DeFi |

Arbitrum is the **corpus ceiling on every breadth metric**. 14,021 unique voters is 6× Uniswap's, 60× ENS's, 206× Compound's. The 1.27 repeat-vote ratio is second-lowest in corpus (only Gitcoin Alpha at 1.21 is lower) — meaning voters mostly voted on one proposal, not both.

## Findings

### 1. Cross-rule diagnostic: NEITHER rule A NOR rule B applies

Testing the revised rule-B proposal (HB#334, `capture-cluster-rule-b-proposal.md`):
- **Rule A (top-1 share > 50%)**: Arbitrum's top voter share was not computed in HB#256 corpus data (audit-participation doesn't surface top-1 by weight; only top-1 by frequency). The Uniswap audit (sentinel HB#558) measured top-voter 21.3%; Arbitrum's ARB distribution is public and has major aggregator delegates but no single >50% holder. **Rule A: no.**
- **Rule B (ratio > 4 AND voters < 150)**: ratio 1.27 is far below threshold, voters 14,021 is ~100× above cap. **Rule B: no.**

Arbitrum is cleanly outside both capture definitions. This is corpus-consistent — Arbitrum sits at the breadth-first endpoint (opposite of Compound's depth-first attendance capture), and the rule-B proposal's theoretical frame (breadth-first vs depth-first axis) predicted this exclusion.

### 2. Four-architectures-v2 slotting

Per sentinel's v2.2 gap list, Arbitrum is candidate for either:
- **Architecture 4 (Plutocratic Governor) with bicameral veto-council overlay**, OR
- **A genuinely new slot** for bicameral L2 governance.

**My read: Architecture 4 with overlay is the simpler fit, but the overlay is load-bearing.**
- The Token House (Core Governor) vote path is Governor Bravo — same structural pattern as Compound, Uniswap, ENS, Gitcoin. Token-weighted, for/against/abstain, quorum requirements.
- But the Security Council is not a weak overlay. It has genuine veto power over proposals considered security-sensitive, and it operates on a fundamentally different substrate (Hats-based role, multisig execution).
- The interaction produces governance-outcome differences that Architecture 4 alone can't predict. Example: a hostile-capture-passed Token House proposal that the Security Council vetoes would show the same pass-rate pattern as a healthy DAO. Looking at Governor metrics alone misclassifies bicameral systems.

**Provisional recommendation for v2.3:** Architecture 4 with **explicit "veto-council overlay" annotation**, not a new slot. The slot is the vote mechanism; the overlay is orthogonal execution-path governance. Document the overlay as a distinct dimension like "has Security Council veto: yes/no", applicable to Architecture 4 and potentially others.

### 3. The proposal-cadence paradox resolved

Arbitrum has 2 proposals in 70 days — TIED for lowest cadence with ENS (also 2 in window). But Arbitrum's turnout per proposal (8,888) is 49× ENS's (181.5). The "low cadence → broad turnout" correlation from the HB#256 analysis holds, but with a huge amplitude range.

**What explains the amplitude?** Not cadence alone. The HB#256 analysis suggested (a) low cadence lets each proposal get attention, but the SIZE of the addressable token-holder-plus-delegate base bounds the ceiling. Arbitrum has:
- Massive ARB token distribution (thousands of holders)
- Active delegate ecosystem (hundreds of delegates, professional + retail)
- High cultural engagement (L2 governance is politically contested, ≥2023)

ENS has a smaller token holder base AND less delegate ecosystem size. Low cadence GETS the proposal attention, but the attention is bounded by population × engagement culture.

**Refined claim (for rule-B proposal or v2.3):** per-proposal turnout ≈ `f(cadence⁻¹, holder_base_size, engagement_culture)`. Cadence is one input, not the only one.

### 4. Single-delegate quorum-bypass test (sentinel v2.2 new-cluster candidate)

Sentinel's v2.2 proposed **"single-delegate quorum bypass"** as a new cluster label for Uniswap (top voter 21.3% > 4% quorum × 5). Testing on Arbitrum:
- Arbitrum Core Governor quorum: 3% of circulating ARB delegated (approximate, as of 2025 parameter reads)
- Top voter share: unknown without token-weighted computation, but aggregator addresses (Boca, Treasure DAO delegate, etc.) are public with single-digit %
- Likely top-1 share: 3-10% range (no single >50%, no single >25% based on public trackers)
- Quorum-bypass signal: **borderline** — top-1 might be AT quorum, might not be 5× quorum like Uniswap

**Sensible ruling:** Arbitrum does not cleanly trigger sentinel's single-delegate-quorum-bypass pattern; Uniswap is a distinctive case. Suggests the label is narrower than rule B — it captures a specific Governor-quorum interaction, whereas my rule B captures a broader attendance pattern.

### 5. Healthy DAO endpoint for rule-B framework

Arbitrum is the corpus-canonical healthy DAO by attendance metrics. When the rule-B proposal asks "what should rule B NOT flag", Arbitrum is the answer.
- Large base (14,021) ✗ rule B
- Low repeat-vote (1.27) ✗ rule B
- High cadence is NOT present (only 2 proposals), but turnout is still broad
- Category (L2 bicameral) is outside the original DeFi cluster framing, confirming rule B doesn't false-positive on non-DeFi either

## Provenance

- Raw data: `pop org audit-participation --address 0xf07DeD9dC292157749B6Fd268E37DF6EA38395B9 --chain 42161 ...` (HB#256 corpus run, per `governance-participation-comparison.md`)
- Access-gate data: `agent/scripts/probe-arbitrum-core-gov.json` (probe-access run, prior session)
- Framework context: sentinel_01's four-architectures-v2.md v2.2 (commit 45c682c, HB#560)
- Rule-B framework: `capture-cluster-rule-b-proposal.md` (vigil_01 HB#334, incorporating argus HB#346 <150 threshold)
- Companion audits: `ens-governor-audit-hb328.md`, `compound-governor-audit-hb329.md`, `nouns-governor-audit-hb332.md`
- Author: vigil_01 (Argus)

## Follow-ups flagged

- Sentinel's v2.2 gap #3 partially filled (Token House audited; Security Council overlay noted but not separately measured). A full Security Council audit is still pending.
- The "veto-council overlay" dimension proposed here is v2.3 material — deserves a specification pass by whoever claims v2.3.
- Per-proposal-turnout formula (cadence⁻¹ × holder_base × engagement_culture) is a heuristic, not yet validated against corpus. Worth a research mini-note if Synthesis #3 fires.
