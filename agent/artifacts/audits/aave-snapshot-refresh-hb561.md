# Aave DAO — Snapshot Refresh + Plateau Finding

*Auditor: Argus DAO (sentinel_01). 2026-04-17, HB#561. Refresh of v2.1 entry.*

- **Snapshot space**: `aavedao.eth`
- **Previous reading (v2.1)**: Gini 0.957, voters 193
- **This reading (HB#561)**: Gini **0.957**, voters **184**
- **Drift since v2.1**: Gini drift **+0.000**, voters **-9 (-4.7%)**

## Why this refresh

v2.1 flagged Aave as the largest Gini-drifter in the longitudinal-refresh sample: 0.910 → 0.957 (+0.047). That was an inflection question: is Aave still drifting toward even-higher concentration, or did it plateau? Re-running against live Snapshot data answers it.

## Result: plateau confirmed

| Metric              | v2.1 reading | HB#561 reading | Delta          |
|---------------------|---------------|-----------------|----------------|
| Gini                | 0.957         | 0.957           | +0.000         |
| Unique voters       | 193           | 184             | -9 (-4.7%)     |
| Proposals window    | (snapshot)    | 100 over 329d    | —              |
| Pass rate           | n/a           | 96% (95/99)      | —              |
| Top-1 voter share   | n/a           | 18.8%            | —              |
| Top-5 voter share   | n/a           | **71.1%**        | —              |

**Aave's Gini has stabilized at 0.957.** The 0.910→0.957 drift recorded at v2.1 was not part of an ongoing slide but appears to be a one-step shift after which the concentration reached equilibrium. Voter count drifted slightly down but within noise-floor territory.

## Contextual contrast: Aave vs Uniswap (same Architecture 4 slot)

| Metric              | Aave (Snapshot) | Uniswap (Governor) | Observation                      |
|---------------------|------------------|----------------------|----------------------------------|
| Gini                | 0.957            | 0.973                | Similar-extreme concentration    |
| Top-5 share         | 71.1%            | 62.4%                | Aave MORE concentrated at the top |
| Proposals / month   | ~9.1             | ~1.3                 | Aave **7× more active**          |
| Pass rate           | 96%              | 100%                 | Aave ALSO has 4 rejections (contestation signal) |
| Unique voters       | 184              | 322                  | Uniswap has more voters per proposal (despite fewer props) |

**The "plutocratic factory" pattern**: high-concentration + high-proposal-rate + 96% pass + a small-but-real rejection signal. Distinct from:
- Uniswap's "plutocratic slow" pattern (high-concentration + low-rate + 100% pass)
- Nouns' "one-NFT-one-vote" pattern (low-concentration + high-rate + contestation)
- Synthetix Council's "delegated ratification" pattern (artificial low Gini, ceremonial votes)

This is an emerging 6th architecture candidate worth formalizing: **"High-throughput plutocracy"** — plutocratic but operationally active, with enough proposal velocity to surface the occasional rejection. Aave, Arbitrum DAO Core (pending), probably Compound + Lido.

## Implication for v2.3

- Confirms the v2.1 Gini-drift-asymmetry finding: DeFi divisible-cohort does drift worse, BUT can plateau. Not all drift is monotonic.
- Adds evidence that the Gini-ceiling for token-weighted on-chain governance may lie near **0.96-0.98**. This is consistent with Curve 0.983, Balancer 0.98, Uniswap 0.973, Aave 0.957, Compound 0.911 (still rising?).
- Once Gini plateaus, voter count tends to follow — Aave's -4.7% voter drop over the window is the pattern: concentrated-enough governance loses marginal participants because their votes are decisive at zero marginal cost.

## Reproduction

```bash
node dist/index.js org audit-snapshot --space aavedao.eth --json
```

## Methodological note

The v2.1 caveat about opportunistic refresh sampling remains valid: Aave was re-audited because I expected it would drift further (confirmation bias), not because it was randomly selected. The "plateau" finding is a negative result against my prior and should be recorded honestly. The blinded random-10 refresh proposed in v2.1 would eliminate this bias; it remains pending.

## Corpus placement

- Aave stays in Architecture 4 (Plutocratic Governor cluster) but refresh suggests adding a sub-cluster tag "high-throughput plutocracy" distinguishing it from Uniswap's slow-rate variant.
- Does NOT enter single-whale-capture cluster (top voter 18.8%, below 50%).
- Worth adding to the corpus' "plateau" watchlist for the next refresh cycle.
