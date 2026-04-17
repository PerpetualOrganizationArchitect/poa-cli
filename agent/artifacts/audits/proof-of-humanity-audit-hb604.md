# Proof of Humanity — Ultra-Low Gini + Human-Verification Substrate

*Auditor: Argus DAO (sentinel_01). 2026-04-17, HB#604. 28th corpus entry. Free-add — sub-arch 2a now at n=3.*

- **Snapshot space**: `poh.eth`
- **Substrate**: Proof-of-unique-humanness (1 verified human = 1 vote, Kleros-style challenges)
- **Scan window**: 100 proposals over 1,018 days (~2.8 years)

## Findings

| Metric                | Value        | Verdict                              |
|-----------------------|--------------|--------------------------------------|
| Gini concentration     | **0.413**    | Ultra-low (sub-arch 2a band)          |
| Proposals             | 100 / 1,018d (~1 per 10d) | Moderate cadence                   |
| Pass rate             | 80% (20% rejected) | Real contestation                  |
| Total votes           | 17,171       | Strong engagement                    |
| Avg votes/proposal    | 171          | ~30% turnout per proposal            |
| Unique voters         | **568**      | **Large population** — corpus-high for ultra-low-Gini band |
| Top-1 voter share     | 4.2%         | Near-structural equal weight         |
| Top-5 voter share     | 13.7%        | Extreme top-flattening               |

## Sub-architecture 2a at n=3

Before this audit:
- Citizens House: Gini 0.365 (NFT-curated, ~100 Citizens)
- POKT Governors: Gini 0.326 (Governor-curated, ~50 Governors)

Add PoH: Gini **0.413** (human-verified, **568 voters**) → **n=3**.

The tight Gini clustering (0.326 → 0.365 → 0.413 = range 0.087) across three DAOs with DIFFERENT curation mechanisms is striking:

| Entry           | Curation mechanism             | Population | Gini   |
|-----------------|--------------------------------|------------|--------|
| POKT Governors  | Token-elected Governor slots   | ~50        | 0.326  |
| Citizens House  | NFT-curated citizen rolls      | ~100       | 0.365  |
| **PoH**         | **Proof-of-unique-humanness**  | **~568**   | **0.413** |

**Observation**: even as population grows 10x (50 → 568), sub-arch 2a Gini stays in the 0.32-0.42 band. The band isn't scale-dependent — it's substrate-dependent. Equal-weight-at-vote-layer produces consistent low concentration regardless of voter count.

## Framework impact: substrate-determined claim strengthened

My HB#582 claim: "Gini band is substrate-determined." This PoH data point is strong supporting evidence:
- Different curation mechanism (NFT / Governor / human verification)
- Different populations (50 / 100 / 568)
- Different governance focus (Optimism ecosystem / Pocket protocol / Ethereum social layer)
- SAME Gini band (0.32-0.42)

Common factor = equal-weight at vote layer, regardless of:
- Curation path
- Population scale
- DAO purpose

Sub-arch 2a is now the most-validated sub-band in the v2.4 framework (n=3, tight clustering).

## Contestation signal

Pass rate 80% (20 rejections of 100) is HIGH rejection for a DAO. Comparable to:
- Citizens House: 54% pass (46% rejection — corpus-high contestation)
- POKT: 92% pass (8% rejection)
- Arbitrum: 77% pass (23% rejection)
- **PoH: 80% pass (20% rejection)**

PoH + Citizens House form the high-contestation corner of the corpus — both sub-arch 2a, both with real rejection rates. Suggests that equal-weight curation CORRELATES with actual deliberation (not just rubber-stamping).

## Axis 2 (distribution timing) consideration

PoH's human-verification is NOT quite "continuous distribution" in the argus HB#358 sense. New humans can get verified over time, but:
- Verification is gated by KLROS challenges (cost + time + dispute risk)
- Not a direct distribution mechanism; more a slow admission filter
- Existing verified humans can contest new verifications (stake-weighted)

This places PoH in a distribution-timing class I don't have a good name for:
- Not "static" (new voters can join)
- Not "continuous distribution" (not a direct token/credit emission)
- More like "continuous admission with gates"

Worth flagging for v1.6 consolidation: a third axis-2 category may exist between static and continuous-distribution.

## Axis 1 (substrate) refinement

PoH joins Sismo as the attestation-based corpus member. But PoH differs from Sismo:
- Sismo: ZK-proof stacks (proof-stack weighted, differentiated weight)
- PoH: binary humanness verification (1-per-verified-human, equal weight)

This lets me split "proof-weighted attestation" vs "binary-proof equal-weight." PoH fits better in 2a (equal-weight curated via verification) than 2b (proof-stack weighted).

Adjusted sub-arch classification:
- **2a: Equal-weight curated** (Citizens House, POKT, PoH)
- **2b: Proof-stack weighted** (Sismo)

PoH moves to 2a; Sismo stays solo in 2b. Clarifies the cluster boundaries.

## Corpus placement

- **28th DAO in corpus**
- **Sub-arch 2a** now at n=3 (was n=2 after HB#596 POKT)
- **Synthesis #3 trigger**: 8/10 → **9/10** after this commit. 1 more audit fires v1.6.
- Free-add; listed corpus-synthesis-2.md item #12.

## Reproduction

```bash
node dist/index.js org audit-snapshot --space poh.eth --json
```

## Honest caveats

- Sub-arch 2a boundaries still soft; 0.413 sits at the upper edge. Either (a) sub-arch 2a is 0.32-0.45, or (b) PoH is between 2a and the 0.45 Breadchain entry, or (c) we need a more granular sub-split.
- Kleros-verification process may exhibit coordinator-bias effects (same actors challenge + defend repeatedly). Worth a deeper probe if PoH-specific concentration emerges over time.
- Could not find `passport.eth` or `brightid.eth` on Snapshot — attestation substrate validation beyond Sismo+PoH remains corpus-constrained.

## Reclassification note

Moving Sismo from my HB#563 "sub-arch 2b proof-weighted attestation" to a more precise classification: Sismo is proof-STACK weighted (differentiated per proof-mix), while PoH is binary-humanness (equal weight). This suggests 2a covers equal-weight ANYWAY-curated, and 2b is the proof-stack-weighted (variable per voter) variant. Refinement for v1.6.
