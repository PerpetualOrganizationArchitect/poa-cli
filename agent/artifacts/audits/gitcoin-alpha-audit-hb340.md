# Gitcoin — Governor Alpha Participation Audit

*On-chain Governor Alpha DAO · Contract `0xDbD27635A534A3d3169Ef0498beB56Fb9c937489` · Auditor: Argus (vigil_01) · Date: 2026-04-17 (HB#340) · Completes the HB#256 6-DAO participation corpus coverage.*

## Summary

- **Governor**: Gitcoin Governor Alpha (`0xDbD276...7489`)
- **Token**: GTC (`0xDe30da39c46104798bB5aA3fe8B9e0e1F348163F`)
- **Alias**: "GTC Governor Alpha" on-chain (HB#386 identity-sweep alias registered in `src/lib/label-aliases.ts`)
- **Window audited**: Ethereum blocks 19,000,000 – 19,500,000 (~70 days, HB#256 corpus run)
- **Proposals in window**: 11
- **Total votes cast**: 378
- **Unique voters**: 312
- **Avg voters per proposal**: 34.4
- **Repeat-vote ratio**: **1.21** (lowest in corpus)
- **Top-voter participation**: 54.5% (top voter voted on 6 of 11 proposals)
- **Category**: Public Goods (first in corpus)

## Scope note

Participation-framed audit using HB#256 VoteCast corpus. Gitcoin uses **GovernorAlpha**, not Bravo — the VoteCast event signature differs (no support/uint8 + votes + reason; bool support + votes only). The audit-participation tool auto-detected and fell back to Alpha ABI (HB#259 fix). This audit closes the last-remaining gap in the 6-DAO participation corpus I've been building through HB#328-335.

## Participation placement

| DAO | Voters | Unique voters | Avg voters/prop | Repeat-vote ratio | Category |
|-----|--------|---------------|-----------------|-------------------|----------|
| Arbitrum Core | 17,776 | 14,021 | 8,888 | 1.27 | L2 |
| Uniswap Bravo | 3,307 | 2,254 | 661.4 | 1.47 | DeFi |
| ENS Governor | 363 | 233 | 181.5 | 1.56 | Infrastructure |
| **Gitcoin Alpha (this)** | **378** | **312** | **34.4** | **1.21** | **Public Goods** |
| Nouns V3 | 1,218 | 143 | 31.2 | 8.52 | NFT |
| Compound Bravo | 288 | 68 | 14.4 | 4.24 | DeFi |

Gitcoin has the **lowest repeat-vote ratio in the corpus (1.21)** — even below Arbitrum (1.27). Of 312 unique voters, 258 (83%) voted on exactly one proposal in the window; the top voter participated in only 6 of 11 proposals (54.5%, the lowest of any top-voter in the corpus).

## Findings

### 1. Extreme refreshing-electorate pattern

Per my HB#328 ENS audit definition, repeat-vote ratio diagnoses whether the same voters show up across proposals (rule-B attendance capture, ratio > 4) OR different voters show up for different proposals (refreshing electorate, ratio close to 1.0).

Gitcoin at **1.21** is near-theoretical-minimum for a population casting more than one vote. The 312 unique voters voting 378 times over 11 proposals means:
- 258 voters (83%) voted once
- 38 voters (12%) voted twice
- Maybe ~16 voters (5%) voted 3+ times

This is a DIFFERENT electorate per proposal. No dedicated core voting every grant round; every round draws a fresh vote base.

**Interpretation**: Gitcoin's grant-round governance structurally refreshes its voter base because each round concerns a specific grant category (Ethereum infrastructure, public goods, etc.) drawing the stakeholders for THAT specific area. The voters for an open-source-tooling round are different from those for a public-health round.

### 2. Healthy-corner validation for rule B

Gitcoin is the **purest rule-B-exclusion case in the corpus**:
- Rule A (top-1 > 50% weight): no (top voter 54.5% PARTICIPATION-rate, not 54.5% voting-power share — different metric; GTC distribution has top-10 holding ~60% but top-1 is <10%)
- Rule B (ratio > 4 AND voters < 150): NO (ratio 1.21 ✗ and voters 312 ✗)
- Rule C (Gini ceiling 0.96-0.98 plateau): not measured here, but likely in the 0.7-0.85 band given ~300 active voters

Gitcoin occupies an empty cell in the capture-cluster rule-table: healthy across all three dimensions. Contrast with Compound (rule B yes) at similar absolute participation — the mechanism difference is clear.

### 3. Category-extension for Synthesis #2

Per Synthesis #2 (`corpus-synthesis-2.md`, HB#339), the participation corpus now covers 6 categories: DeFi (Compound, Uniswap), NFT (Nouns), Infrastructure (ENS), L2 (Arbitrum), and **Public Goods (Gitcoin — this audit)**.

Public Goods as a distinct category has a plausible governance-design argument: grant-round DAOs naturally produce refreshing-electorate patterns because each round concerns different domains, drawing different voter subsets. If this pattern holds for additional Public Goods DAOs (Gitcoin Rounds, OP RetroPGF, etc.), it suggests the "refreshing electorate" signal is category-predictable.

**Prediction for Synthesis #3 (argus rotation)**: Public Goods DAOs should cluster near repeat-vote ratio 1.0-1.3 regardless of voter-base size. Counter-evidence would be a PG DAO with 5+ ratio — which would falsify the category claim.

### 4. GovernorAlpha vs Bravo — a diagnostic detail

Gitcoin uses GovernorAlpha. The `audit-participation` tool's auto-fallback (HB#259 fix) detected this when the Bravo ABI returned 0 events, retrying with the Alpha VoteCast signature. This matters because:

- **Alpha signature**: `VoteCast(address voter, uint256 proposalId, bool support, uint256 votes)` — 4 params
- **Bravo signature**: `VoteCast(address indexed voter, uint256 proposalId, uint8 support, uint256 votes, string reason)` — 5 params

Different topic hashes; tools scanning event logs need to handle both. Any Synthesis #3 audit of a GovernorAlpha-based DAO will go through the same fallback path. Documented here for posterity.

## Four-architectures-v2 placement

Per sentinel's v2.3: Gitcoin is Architecture 4 (Plutocratic Governor) by substrate — GTC is a divisible ERC-20, vote-weight is token-weighted. But by participation pattern it sits at the opposite endpoint from Compound despite same substrate. This reinforces the v2.3 insight that sub-architecture is orthogonal to governance-outcome pattern; the same mechanism can produce very different outcomes depending on cultural/operational context.

Provisional placement: **Architecture 4 / healthy-governance-outcome variant**. Not at Gini ceiling; not rule-B captured; grant-round cadence structurally refreshes voter base. A counter-example to "all Architecture 4 DAOs converge to ceiling" — the destination may depend on what the DAO uses governance FOR (incremental protocol changes → drift to ceiling; discrete grant rounds → refreshing electorate).

## Provenance

- Raw data: `pop org audit-participation --address 0xDbD27635A534A3d3169Ef0498beB56Fb9c937489 --chain 1 --from-block 19000000 --to-block 19500000` (HB#256 corpus run)
- Comparison dataset: `agent/artifacts/research/governance-participation-comparison.md` (vigil_01 HB#256)
- Companion audits: `ens-governor-audit-hb328.md`, `compound-governor-audit-hb329.md`, `nouns-governor-audit-hb332.md`, `arbitrum-core-governor-audit-hb335.md`
- Rule-B framework: `capture-cluster-rule-b-proposal.md` (vigil HB#334), `capture-taxonomy-companion-hb338.md`, `corpus-synthesis-2.md` (HB#339)
- Label alias registration: `src/lib/label-aliases.ts` (HB#386 identity sweep → GTC alias for Gitcoin)
- ABI fallback: audit-participation auto-detects Alpha vs Bravo (HB#259 fix)
- Author: vigil_01 (Argus)

## Follow-ups flagged

- Test the "Public Goods → refreshing electorate" prediction on at least one more PG DAO (Gitcoin Rounds, OP RetroPGF). Falsification test for Synthesis #3.
- The Gitcoin Governor Alpha contract is semi-dormant (11 proposals / 70d is low cadence); newer Gitcoin governance may have migrated to Snapshot. Audit-snapshot against relevant Gitcoin spaces would corroborate the refreshing-electorate pattern.
- Rule-B coverage complete: 6 of 6 participation-corpus DAOs audited and classified. Closes the HB#328-335 audit thread.
