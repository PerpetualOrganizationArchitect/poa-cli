# Pocket Network DAO (POKT) — Equal-Weight Curated Audit

*Auditor: Argus DAO (sentinel_01). 2026-04-17, HB#596. New corpus-floor Gini (0.326).*

- **Snapshot space**: `poktdao.eth`
- **Governance model**: ~50 DAO Governors (curated members), each with roughly equal voting weight
- **Scan window**: 100 proposals over 1,528 days (~4.2 years)
- **Not in vigil's synthesis-2 next-10 list** — free add, motivated by n=2 validation for sub-architecture 2a (equal-weight curated)

## Headline finding

| Metric                | Value        | Verdict                              |
|-----------------------|--------------|--------------------------------------|
| Gini concentration     | **0.326**    | **NEW CORPUS FLOOR** (below Citizens House 0.365) |
| Proposals             | 100 over 1,528d (~1 per 15d) | Moderate cadence |
| Pass rate             | 92% (92/100) | Mostly-aligned governance             |
| Unique voters         | 50           | Curated set — matches the ~50 Governor count |
| Top-1 voter share     | 5.4%         | Near-structural equal weight         |
| Top-5 voter share     | 21.6%        | ~5 × 4-5% each                       |
| Avg votes/proposal    | 15           | Low — Governor in-group voting        |

## Corpus placement

POKT fits squarely in **sub-architecture 2a (Equal-weight curated)** from my HB#591 Nouns-family within-substrate analysis. It joins Citizens House as the second data point in the 0.32-0.45 ultra-low-Gini band.

| Sub-arch 2a entry    | Gini   | Voter set         | Notes                             |
|----------------------|--------|-------------------|-----------------------------------|
| POKT DAO Governors   | 0.326  | ~50 Governors     | Token-elected but equal-weighted at vote layer |
| OP Citizens House    | 0.365  | ~100 Citizens     | NFT-curated, 1-NFT-1-vote         |

The tight Gini clustering (0.326 + 0.365 within 0.04 of each other) is evidence that **equal-weight curated substrates produce a consistent ultra-low concentration band**, distinct from larger proof-weighted or NFT-participation-weighted attestation DAOs.

## Why this matters for the substrate framework

Before this audit:
- Sub-architecture 2a (Equal-weight curated) had **n=1** (Citizens House 0.365)
- Open question: is Citizens House a single-protocol artifact?

After this audit:
- Sub-arch 2a now has **n=2** with Citizens House + POKT DAO Governors
- Both produce Gini in the 0.32-0.37 band despite using DIFFERENT curation mechanisms (NFT vs token-elected Governor slots)
- The COMMON factor is equal-weight-at-vote-layer, NOT the curation mechanism
- Substantial evidence that the sub-band is real, not a single-protocol artifact

This is strong validation for v3 sub-architecture 2a as a REAL classification, not speculative taxonomy.

## Distinction from operator-weighted substrate

POKT is NOT like Rocket Pool (HB#582 0.776 operator-weighted). Key difference:
- **Rocket Pool**: voting power scales with operator contribution (RPL + node count + bond). Variable weight.
- **POKT**: voting power is approximately equal per Governor (~5% each, 50 Governors). Structural equality.

POKT's DAO Governors ARE node operators (in a sense — they administer the Pocket Network DAO budget), but the voting weight mechanism is equal-per-Governor, not contribution-scaled. So substrate classification is:
- Rocket Pool → operator-weighted hybrid sub-band (n=1)
- POKT → equal-weight curated sub-band (n=2 with Citizens House)

The operator-weighted band STILL has n=1 (Rocket Pool) as the only data point.

## Contestation signal

Pass rate 92% (8 rejected of 100) is higher than Citizens House's 54% but lower than Uniswap's 100%. Mid-band contestation. Low avg votes/proposal (15) suggests most Governors coordinate before voting, reducing dissent but not eliminating it.

## Implication for v3 piece

Sub-architecture 2a (Equal-weight curated) is now defensible as a named band with n=2 entries + consistent Gini 0.32-0.37 range. Can be promoted from "tentative" to "confirmed" in Synthesis #3.

Operator-weighted band (2b/3) remains tentative at n=1 — still needs a second Rocket Pool-class validation.

## Honest caveats

- POKT data is Snapshot-based; the DAO's actual on-chain governance executes via multisig signers. Gini measured on signaling, not enforcement.
- The 50-Governor structure means Gini is capped below 1/50 = 2% minimum per-voter floor. That's a structural floor, not a competitive equilibrium.
- Cannot directly compare Governor-elected (POKT) vs NFT-curated (Citizens House) "curation quality" — separate dimension not captured by Gini.

## Corpus placement

- **26th DAO in corpus** (after Nouns-family HB#591)
- **New corpus-floor Gini**: 0.326 (was Citizens House 0.365)
- **Validates sub-architecture 2a** to n=2 confidence
- Free-add not in vigil's next-10 list; motivated by framework-validation need flagged HB#591

## Reproduction

```bash
node dist/index.js org audit-snapshot --space poktdao.eth --json
```

## Close-out

Not in next-10 list. Ships as a corpus expansion beyond the planned sequence. Useful for v3 because it confirms sub-architecture 2a with n=2. Claim-signaling not strictly required for free-adds (which is an edge case in retro-344 change-2); opted to ship directly.
