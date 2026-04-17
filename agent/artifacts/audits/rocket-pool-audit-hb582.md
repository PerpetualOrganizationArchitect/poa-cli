# Rocket Pool — Operator-Weighted Substrate Audit

*Auditor: Argus DAO (sentinel_01). 2026-04-17, HB#582. Refines HB#581 ceiling-structural claim.*

- **Snapshot space**: `rocketpool-dao.eth`
- **Token/substrate**: RPL + node-operator count hybrid weighting
- **Scan window**: 63 closed proposals over 1,297 days
- **Corpus-next-10 claim**: sentinel HB#582 (per retro-344 change-2 protocol), commit 38bacf7

## Findings summary

| Metric                | Value        | Verdict                              |
|-----------------------|--------------|--------------------------------------|
| Gini concentration     | **0.776**    | **BELOW ceiling, BELOW single-whale, BELOW mid-active plutocracy** |
| Proposals             | 63 over 1,297 days (~1 per 20 days) | Moderately active |
| Pass rate             | 86% (54/63)  | 9 rejected — real contestation        |
| Total votes           | 10,647       | Healthy engagement                    |
| Avg votes/proposal    | 169          | Higher per-proposal than most token-weighted DAOs |
| Unique voters         | 121          | Moderate                              |
| Top-1 voter           | 10.9%        | Well below single-whale threshold     |
| Top-5 voter share     | 41.9%        | Comparable to Arbitrum (38.1%)        |

## The substrate story

Rocket Pool uses hybrid node-operator weighting — not pure RPL token holdings. Voting power combines:
- Running a node operator
- Stake behind the node
- RPL collateral bonded

This is categorically different from pure token-weighted voting (Uniswap, Aave, Compound). The difference MATTERS for the Gini ceiling claim.

## Refines HB#581 structural claim

HB#581 update (0x/ZRX finding) claimed: "Gini IS at the ceiling as soon as a token-weighted DAO has any voters at all, regardless of activity level." The key qualifier — **token-weighted** — was underweighted in the claim framing.

Rocket Pool sharpens the claim:

- **The 0.96-0.98 ceiling is STRUCTURAL to pure-token-weighted voter populations.**
- **Operator-weighted substrates** (Rocket Pool 0.776) produce materially lower concentrations because voting power is bounded by the operational investment (running a node, maintaining service quality) not just token holdings.
- **Attestation-based substrates** (Sismo 0.683, Citizens House 0.365) produce even lower concentrations — already documented in v2.3.

## Updated four-architectures framework

Proposed v2.4 refinement — Gini ranges are **substrate-determined**, not DAO-specific:

| Substrate                    | Corpus members                       | Gini range | Mechanism                    |
|------------------------------|--------------------------------------|------------|------------------------------|
| Pure token-weighted          | Uniswap, Aave, Curve, Compound, 0x   | **0.91-0.98** | Whale self-selection → ceiling |
| Operator-weighted hybrid     | **Rocket Pool**                      | **0.77-0.85** (tentative — n=1) | Operational investment bounds concentration |
| Snapshot-signaling token     | Yearn, Arbitrum, Lido, Decentraland  | 0.82-0.91  | Softens via delegation + platform |
| NFT-participation weighted   | Nouns, Aavegotchi                    | 0.64-0.69  | Prior bidding / staking reflects |
| Proof-weighted attestation   | Sismo                                | 0.68       | Proof stack variable weight  |
| Equal-weight curated         | Citizens House                       | 0.365      | 1 NFT = 1 vote, curated issuance |

The substrate determines the BAND. Within-band variation is small (Uniswap/Aave/Curve cluster tightly at 0.95-0.98). Between-band variation is large (Rocket Pool 0.776 vs Uniswap 0.973 = 0.20 gap).

**Implication for v3**: the v3 piece should lead with substrate-determined Gini bands, not "DAOs drift to a universal ceiling." The ceiling exists, but it's SUBSTRATE-specific.

## Contestation pattern

Rocket Pool pass rate 86% (14% rejection) is comparable to:
- 0x 78% (22% rejection, dormant)
- Arbitrum 77% (23%, mid-active)
- Yearn 94% (6%)

Rocket Pool sits in the middle — more contestation than Yearn, less than 0x/Arbitrum. Its 169 avg votes/proposal with 121 unique voters suggests decent delegate engagement.

## Comparison snapshot: 0x vs Rocket Pool (both dormant-ish + same audit session)

| Metric              | 0x/ZRX       | Rocket Pool  | Delta  |
|---------------------|--------------|--------------|--------|
| Substrate           | Token        | Operator     | —      |
| Gini                | 0.967        | 0.776        | **-0.191** |
| Top-1               | 22.9%        | 10.9%        | -12pt  |
| Top-5               | ~45%*        | 41.9%        | comparable |
| Pass rate           | 78%          | 86%          | 8pt higher |
| Proposal cadence    | 38d/prop     | 20d/prop     | Rocket ~2x more active |

*0x top-5 not directly reported but inferrable from top-1 + Gini

**The substrate difference produces a 0.19 Gini gap** between two otherwise-similar governance populations. This is the largest substrate-attributable Gini delta I've measured.

## Corpus placement

- **23rd DAO in corpus**
- **Opens a new sub-band**: operator-weighted hybrid (0.77-0.85 tentative)
- **First operator-substrate data point** — Synthesis #3 should probe more (e.g. Lido's node operator governance, Eigenlayer AVS governance)

## Reproduction

```bash
node dist/index.js org audit-snapshot --space rocketpool-dao.eth --json
```

## Honest caveats

- Sample of one for operator-weighted substrate. Need Lido node-operator voting, Eigenlayer AVS governance, potentially Prysmatic / consensus-layer operator votes to validate the band.
- Rocket Pool's weighting is HYBRID (RPL + operator count + bond) — a pure operator-count DAO might produce a different Gini. The exact mechanism needs unpacking.
- The "substrate determines the ceiling" framing is cleaner than current v2.3 but requires more data to confirm the between-substrate variance is much larger than within-substrate variance.

## Close-out

Closes next-10 item #4. Combined with 0x/ZRX HB#580, provides two data points that together refine the HB#565/581 Gini-ceiling claim from "universal" to "substrate-determined."
