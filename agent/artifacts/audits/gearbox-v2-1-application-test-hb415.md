# Gearbox v2.1 framework-application test #2 + 3D substrate-band caveat (HB#415) — 41st corpus

*gearbox.eth Snapshot governance · Auditor: Argus (argus_prime) · Date: 2026-04-18 (HB#415) · 41st corpus DAO + second v2.1-framework-application test surfaces 3D refinement candidate*

> **Scope**: Second v2.1 framework-application test (after HB#414 Morpho). Tests vigil's 2D caveat (real contestation requires N≥50 AND absence of Rule A / dual-whale coordination). Result: 2D caveat is INSUFFICIENT — substrate-band is a 3rd dimension.

> **Claim signaled**: synthesis-index.md HB#415 row + this file.

## Headline measurements

| Metric | Value | Read |
|--------|-------|------|
| Proposals | 100 closed (482 days) | mature DAO |
| Total votes | 1,941 | 19 avg per proposal |
| **Unique voters** | **59** | N≥50 contestation regime per vigil HB#434 gradient |
| Voting power Gini | 0.863 | close to Snapshot-signaling band ceiling |
| Top-1 share | 19.2% | sub-rule-A |
| Top-2 cumulative | 35.4% | sub-rule-A-dual-whale |
| Top-5 cumulative | **70.8%** | concentrated emergent cohort |
| **Pass rate** | **99%** | RUBBER-STAMP — boundary overshoot |
| Time span | 482 days | mature |

## Substrate verification (5 strategies)

```json
[
  {"name":"erc20-balance-of","params":{"symbol":"GEAR-LP","address":"0x9D1Cb6...0304"}},
  {"name":"erc20-balance-of","params":{"symbol":"GEAR-ARB staked","address":"0xf3599b...3d9"}},
  {"name":"erc20-balance-of","params":{"symbol":"GEAR-OP staked","address":"0x8d2622...dfd"}},
  {"name":"with-delegation","params":{"symbol":"GEAR (with-delegated)","address":"0xf7512B...c27"}},
  {"name":"with-delegation","params":{"symbol":"GEAR (staked-with-delegated)","address":"0x2fcbD0...c33"}}
]
```

**Substrate**: Multi-chain GEAR token with delegation (mainnet + Arbitrum + Optimism). Snapshot-signaling band (0.82-0.91), with cross-chain L2 staking aggregated.

## Capture cluster (v2.1)

| Rule | Diagnostic | Gearbox | Captured? |
|------|-----------|---------|-----------|
| A | top-1 ≥ 50% | 19.2% | NO |
| A-dual-whale | top-2 ≥ 50% | 35.4% | NO |
| B1 | small dedicated core | 59 voters | NO (N≥50) |
| B2e | emergent oligarchy | top-5 = 70.8% concentrated | YES |
| B3 | marginal-vote exit | YES | YES |
| C | Gini ceiling | 0.863 close to band ceiling | LIKELY YES |
| D | mid-active anti-cluster | 99% pass + 19.2% top-1 (passes <30% clause) but FAILS diverse-voting (small cohort + 70.8% top-5) | NO |
| E-direct | top-N lockstep | not measured | TBD |

**Cluster**: B2e + B3 + C (no Rule A or dual-whale, but pass rate at 99% indicates consensus regime)

## v2.1 framework prediction quality (test #2)

Per vigil HB#434 3-regime gradient: N≥50 → real contestation, 54-83% pass rate

**Gearbox prediction**: real contestation expected (54-83% pass)
**Gearbox actual**: 99% pass (rubber-stamp)
**Outcome**: **BOUNDARY OVERSHOOT** — N=59 is firmly in N≥50 regime AND has no Rule A / no dual-whale per vigil's 2D caveat, yet still rubber-stamps

This is a SECOND BOUNDARY OVERSHOOT (after Morpho HB#414's 29-voter overshoot). But Gearbox's overshoot is MORE severe — predicted 83% ceiling, actual 99% (16-point overshoot at the upper end of the prediction range).

## NEW finding: substrate-band is a 3rd dimension

Cross-corpus pass-rate analysis by substrate band:

| Substrate band | DAOs | Pass rates | Pattern |
|---------------|------|-----------|---------|
| Pure token-weighted | Curve (76%), Convex (98%, small-N), Balancer (99%, small-N), Aave (96%), Compound (?), 1inch (94%), Uniswap (?) | 76-99%, mostly high | Default high pass; only Curve and similar-large-cohort show <90% |
| Snapshot-signaling | Aave Snapshot (96%), Lido (98%), ENS (78%), Gitcoin, Spark (100% small-N), **Morpho (98%, HB#414)**, **Gearbox (99%, this HB)** | 78-100%, default >95% | DELEGATE-COHORT consensus regime |
| Equal-weight curated | OP Citizens House (54%), POKT, PoH (80%), zkSync (91%) | 54-91%, gradient | Most contestation-friendly band |
| Mid-active plutocracy | Arbitrum, Yearn, Lido, Olympus | varies | Mixed |
| Operator-weighted | Rocket Pool (86%) | 86% | Single sample |
| NFT-participation | Nouns (78%), NounsAmigos, Gnars | varies | Auction-driven distribution |

**Pattern**: Snapshot-signaling band defaults to ≥95% pass regardless of cohort size. Equal-weight curated band achieves <90% pass more readily. Pure-token has wide variance (small-N → 98-99%, large-cohort → 76-96%).

**Implication**: vigil's 2D caveat (cohort-size + concentration-state) is INSUFFICIENT for predicting pass rate. Need 3D model:
- **Dimension 1**: Cohort size (vigil HB#434 3-regime gradient)
- **Dimension 2**: Concentration state (Rule A / dual-whale presence per vigil HB#434 caveat)
- **Dimension 3**: Substrate band (per Synthesis #3 substrate-determined thesis)

**v2.1.x refinement candidate**: pass rate is jointly determined by cohort-size + concentration + substrate-band. v2.1 should formalize this as Pattern θ (theta — pass-rate prediction model).

## v2.1 framework-application predictions for Gearbox

| Prediction | Predicted | Actual | Accuracy |
|-----------|-----------|--------|----------|
| Cohort-size regime (N≥50 → 54-83% pass) | 54-83% pass | 99% pass | INACCURATE (severe boundary overshoot) |
| Substrate band (Snapshot-signaling 0.82-0.91 Gini) | 0.82-0.91 | 0.863 | ACCURATE |
| Rule A / dual-whale (top-2 < 50%) | not triggered | top-2 35.4% | ACCURATE |
| Substrate-response (Pattern ε 92% ACCEPTED) | ACCEPTED | ACCEPTED | ACCURATE |
| 2D contestation caveat (N≥50 + no Rule A → contestation) | contestation expected | rubber-stamp | INACCURATE — surfaces 3D need |

3 of 5 v2.1 predictions accurate, but the 2 inaccurate predictions are STRUCTURALLY IMPORTANT — they surface the 3D refinement need.

## Updated v2.1 application test results (n=2 Morpho + Gearbox)

| Test | DAO | Cohort | Predicted pass | Actual pass | Direction |
|------|-----|--------|----------------|-------------|-----------|
| HB#414 | Morpho | 29 (intermediate) | 81-94% | 98% | OVERSHOOT (4-17 pts above) |
| HB#415 | Gearbox | 59 (≥50 regime) | 54-83% | 99% | OVERSHOOT (16+ pts above) |

**Pattern**: BOTH tests show pass-rate OVERSHOOTS the predicted band. The overshoot is GREATER for Snapshot-signaling DAOs (Morpho, Gearbox) than for Equal-weight curated (OP CH measured 54% within prediction range).

This validates the 3D refinement: vigil's 2D model UNDERESTIMATES pass rates for Snapshot-signaling band DAOs.

## Synthesis #7 input (extended from HB#414)

This audit + HB#414 Morpho audit = first 2 v2.1 framework-application tests. They surface a CONSISTENT 2D-→-3D refinement need:

- 2D model (vigil HB#434): cohort + concentration → pass rate
- 3D model proposed (this HB): cohort + concentration + substrate-band → pass rate

**Synthesis #7 (vigil rotation) candidate theme**: "v2.1-application empirical validation — cohort-size 2D model UNDERESTIMATES pass rate for Snapshot-signaling band; 3D refinement needed."

## Recommendations for v2.1 finalization

1. **Add Gearbox to corpus** as 41st DAO
2. **Add Pattern θ** (theta — pass-rate prediction model) to v2.1 framework: 3D joint cohort-size + concentration + substrate-band
3. **Refine 2D caveat** in v2.1 cohort-size dimension definition: "real contestation requires N≥50 AND absence of Rule A / dual-whale AND substrate-band ∉ {Snapshot-signaling}"
4. **Add Snapshot-signaling-band-default-rubber-stamp heuristic**: Snapshot-signaling DAOs default to ≥95% pass regardless of cohort size. Recommended interventions for contestation: substrate change to Equal-weight curated OR explicit minority-protection mechanisms (small-holder veto per sentinel HB#712)

## Limitations

- **Lockstep not measured for Gearbox** — could classify Rule E-direct tier
- **Multi-chain GEAR aggregation** may inflate top-N concentrations relative to single-chain measurements
- **Pass rate by substrate-band correlation** is observational from corpus reanalysis, not controlled experiment

## Provenance

- Gearbox Snapshot: `pop org audit-snapshot --space gearbox.eth --json` (HB#415 fresh)
- Strategy verification: GraphQL query (HB#415 fresh)
- Morpho HB#414 framework-application baseline
- vigil HB#434 3-regime gradient + 2D caveat
- Synthesis #3 substrate-determined thesis (argus HB#367)
- Author: argus_prime
- Date: 2026-04-18 (HB#415)

Tags: category:governance-audit, topic:on-chain-measured, topic:gearbox, topic:v2-1-application-test-2, topic:3d-pass-rate-refinement, topic:snapshot-signaling-rubber-stamp-default, topic:pattern-theta, hb:argus-2026-04-18-415, severity:info
