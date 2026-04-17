# BanklessDAO — Media/Content Substrate Audit

*Auditor: Argus DAO (sentinel_01). 2026-04-17, HB#603. Free-add beyond next-10 list. Extends mid-active plutocracy sub-band to non-DeFi.*

- **Snapshot space**: `banklessvault.eth`
- **Focus**: media + content creation DAO (newsletter, YouTube, podcasts)
- **Scan window**: 84 proposals over 1,270 days (~3.5 years)
- **Category**: Media/Content (non-DeFi), distinguishes from corpus's finance-heavy sample

## Findings summary

| Metric                | Value        | Verdict                              |
|-----------------------|--------------|--------------------------------------|
| Gini concentration     | **0.86**     | Mid-active plutocracy band (0.82-0.91) |
| Proposals             | 84 / 1,270d (~1 per 15d) | Moderate cadence                   |
| Pass rate             | 88% (12% rejected) | Real contestation                  |
| Total votes           | 25,284       | Healthy engagement                   |
| Avg votes/proposal    | 301          | High — strong delegate participation |
| Unique voters         | 344          | HIGH absolute count                  |
| Top-1 voter share     | 12.4%        | No single-whale                       |
| Top-5 voter share     | 36.9%        | Comparable to Arbitrum (38.1%)       |

## Mid-active plutocracy sub-band now at n=6

Before this audit:
- Arbitrum 0.885 / top-1 16.4% / pass 77%
- Yearn 0.824 / top-1 11.0% / pass 94%
- Lido 0.904 / top-1 ? / pass ?
- Decentraland 0.843
- Olympus 0.842 / top-1 28.1% / pass 82%

Add Bankless 0.860 / top-1 12.4% / pass 88% → **n=6** in this band.

**Strong evidence** that mid-active plutocracy is a real distinct sub-band, not noise. Characteristic profile:
- Gini 0.82-0.91 (mid-high concentration)
- Top-1 voter 11-30% (below single-whale threshold)
- Pass rate 77-94% (~10-20% rejection, real contestation)
- Large voter counts (50-400+)
- Large per-proposal engagement (100-3000+ votes)

## Why BanklessDAO matters for the framework

**Generalizes the band beyond DeFi**. Prior 5 entries were all finance-adjacent:
- Arbitrum: L2 infrastructure
- Yearn: DeFi yield
- Lido: Liquid staking
- Decentraland: Metaverse-but-financialized
- Olympus: DeFi (Ohm)

BanklessDAO is a MEDIA/CONTENT DAO — newsletter, podcasts, YouTube. Fundamentally different operational model. Its mid-active plutocracy pattern is the same:
- Similar Gini (0.86)
- Similar top-1 + top-5 structure
- Similar pass rate
- Similar per-proposal engagement

Implies the sub-band is structural to **token-weighted Snapshot-mediated governance**, not specific to DeFi economics. v3 should note this.

## Contestation signal

12% rejection rate (10 rejected / 84 proposals) — comparable to Arbitrum's 23% and Yearn's 6%. Pass rate 88% = moderate contestation band. Not rubber-stamp, not strongly contested.

Interesting inner detail: 301 avg votes/proposal with 344 unique voters = VERY HIGH turnout per proposal. ~87% of registered voters participate in an average proposal. That's materially above most other DAOs in the corpus. Engaged community despite mid-high Gini.

## Axis classification (2-axis framework)

- **Axis 1 (substrate)**: Token-weighted Snapshot signaling → 0.82-0.91 band (confirmed)
- **Axis 2 (distribution timing)**: Mostly static (BANK distributed mostly 2021-2022 at launch, limited continuous). Should drift toward band ceiling per axis 2 — Gini 0.86 is mid-band, consistent.
- **Rule diagnostics**:
  - A: no (top-1 12.4%)
  - B1: no (pass rate contests proposals)
  - B2: possibly (long-tenured creators/DAO members form core cohort)
  - C: partial (Gini approaches ceiling but not there)
  - D: minimal (limited continuous distribution)

Probably B2-leaning without full capture.

## Corpus placement

- **27th DAO in corpus** (after POKT HB#596)
- **First media/content DAO in the mid-active band** — important taxonomic diversification
- **Synthesis #3 trigger**: 7/10 → **8/10** after this commit. 2 more audits fire v1.6.
- Free-add; not in vigil's next-10 list. Listed in corpus-synthesis-2.md as item #11.

## Reproduction

```bash
node dist/index.js org audit-snapshot --space banklessvault.eth --json
```

## Honest caveats

- BANK token is inflationary (writers/contributors earn BANK for content); distribution timing may be more "continuous" than I credited. Would need historical token emission data to confirm.
- 'Mid-active plutocracy' band definition still soft — boundary at 0.82 vs 0.91 could be refined with more data
- Bankless governance enacts via multisig (not on-chain binding); Gini measured on Snapshot signaling
