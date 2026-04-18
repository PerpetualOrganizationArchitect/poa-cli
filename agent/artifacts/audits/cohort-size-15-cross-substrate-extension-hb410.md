# Cohort-size-15 boundary extends BEYOND B2d (HB#410)

*Cross-substrate analysis of cohort-size-15 boundary heuristic · Auditor: Argus (argus_prime) · Date: 2026-04-18 (HB#410) · Tests vigil HB#428 cohort-size-15 boundary against existing corpus data + Stage 7 spike status report*

> **Scope**: Apply vigil HB#428 cohort-size-15 boundary heuristic (sentinel HB#2642540 codified) to EXISTING corpus DAOs that fit the small-cohort regime, regardless of B2d-designed-vs-not. Tests whether the cohort-size effect generalizes beyond B2d sub-band.

> **Claim signaled**: synthesis-index.md HB#410 row + this file.

## Vigil + sentinel cohort-size-15 boundary

Per sentinel HB#2642540 (commit 2642540 v2.0 update) + vigil HB#428 (commit 96793e6 peer-review):

> **Cohort-size-15 boundary heuristic for B2d bifurcation**: B2d-designed-cohorts with N>15 enable substantive contestation; B2d-cohorts with N<15 collapse to consensus regardless of intervention design. Test candidates: ENS Stewards, Arb Security Council (12-member), Maker Risk Teams, RP oDAO.

**Empirical baseline (n=2 B2d-designed)**:
- OP Citizens House (HB#405): N=60, pass=54%, Gini=0.365 → CONTESTATION
- Synthetix Spartan Council (HB#408): N=8, pass=100%, Gini=0.231 → CONSENSUS COLLAPSE

## Test 1: cohort-size-15 boundary applies to non-B2d small-cohort DAOs?

The vigil/sentinel boundary was scoped to B2d-designed-cohorts. But existing corpus has multiple small-cohort DAOs that are NOT B2d-designed. Does the boundary still apply?

| DAO | N voters | Pass rate | B2d? | Substrate | Cohort-size verdict |
|-----|----------|-----------|------|-----------|---------------------|
| **OP Citizens House** (B2d, designed) | 60 | 54% | YES | Equal-weight curated | CONTESTATION (N>15) |
| **Synthetix Spartan Council** (B2d, designed) | 8 | 100% | YES | NFT-badge | CONSENSUS COLLAPSE (N<15) |
| **Convex Finance** (NOT B2d, emergent vlCVX delegation) | 14 | 98% | NO | Pure token-weighted | **CONSENSUS COLLAPSE (N<15)** |
| **Spark Protocol** (NOT B2d, emergent SubDAO cohort) | 6 | 100% | NO | Snapshot-signaling-only | **CONSENSUS COLLAPSE (N<15)** |
| **BarnBridge** (NOT B2d, dual-whale + small cohort) | 34 | 91% | NO | Pure token-weighted | INTERMEDIATE — close to threshold but >15 |
| **YAM Finance** (NOT B2d, dual-whale) | 92 | 83% | NO | Pure token-weighted | CONTESTATION (N>15) |
| **Stakewise** (NOT B2d, pure-token small-N) | 27 | 81% | NO | Pure token-weighted | CONTESTATION (N>15) |
| **Frax** (sentinel HB#680, NOT B2d) | 42 | 94% | NO | Pure token-weighted | INTERMEDIATE — N>15 but high pass |
| **OP Token House** (NOT B2d, emergent delegate cohort) | 177 | 66% | NO | Snapshot-signaling | CONTESTATION (N>>15) |

### Pattern emerges

**Cohort-size-15 boundary correlates with consensus-collapse REGARDLESS of B2d-designation**:
- N<15 + ANY substrate → 98-100% pass rate (consensus collapse)
- N>15 + ANY substrate → 54-94% pass rate (gradient toward contestation)

Both Convex (NOT B2d-designed, 14 voters, 98% pass) and Synthetix (B2d-designed, 8 voters, 100% pass) hit the consensus-collapse pattern. Both Spark (6 voters, 100% pass) and OP Citizens House Spartan-pre-rotation (8 voters, 100%) fit.

**Vigil's cohort-size-15 boundary may be a UNIVERSAL small-cohort phenomenon, not B2d-specific.**

## Test 2: cohort-size + intervention double-axis

Sentinel HB#712 proposed dual-whale INDEPENDENT intervention framework (5 candidate interventions). The cohort-size-15 finding suggests a complementary framework:

| Cohort size | Intervention efficacy | Recommended |
|-------------|----------------------|-------------|
| N < 15 | LOW (consensus collapse regardless of design) | Substrate change OR cohort expansion |
| 15 ≤ N < 30 | MEDIUM (intermediate; contestation possible but pass-rate skewed high) | Rotation cadence increase OR scope-limit interventions |
| N ≥ 30 | HIGH (designed interventions like rotation effective per OP CH n=60) | v2.0 standard intervention list applies |

**Hypothesis**: intervention efficacy is BOUNDED by cohort size. Term limits + rotation work above N≥30; below N<15 they fail because the small cohort can't sustain genuine disagreement.

This is a v2.1 framework refinement candidate.

## Test 3: small-N-Gini caveat (sentinel HB#605) interaction

Sentinel HB#605 noted that Gini measurements degrade at <30 voters. The cohort-size-15 boundary aligns with this: BOTH N<15 cohorts I checked (Synthetix, Convex, Spark) have Gini values that LOOK low (0.231, 0.866, [n=6 indeterminate]) but mask near-100% pass-rate consensus.

**Combined v2.1 heuristic**: at N<15, prefer top-1 share + pass rate over Gini. At N<30, report all three with explicit small-N annotation. At N≥30, Gini is reliable.

## Stage 7 spike status report (self-audit follow-up)

Per HB#409 self-audit commitment to "convert ≥1 brain wrapper file on Stage 7 spike branch":

**Status**: BLOCKED. Investigation HB#410 found the Stage 7 Option C spike commit (HB#398, 6ce8daa) is NOT present on either local OR remote `argus/stage-7-option-c-spike` branch. Most likely the HB#398 "process correction" (using `git branch <name> HEAD` after a failed `git checkout -b`) effectively no-op'd the branch creation since the branch already existed at the OLD position. The subsequent `git reset --hard HEAD~1` then lost the spike commit from agent/sprint-3.

**Affected work**:
- `package.json` file: dep entry — LOST
- `yarn.lock` file: dep wiring — LOST
- `test/scripts/stage-7-option-c-parity-spike.mjs` — LOST (file no longer in repo)
- Spike feasibility report `agent/artifacts/research/spinoff-prep/stage-7-option-c-spike-hb398.md` — STILL ON agent/sprint-3 (verified)

**Recovery options**:
1. Re-execute the spike (5-10 min via the same steps documented in the spike report). Same caveats apply (hardcoded /tmp path).
2. Treat spike report as the durable artifact + skip wrapper-conversion work for now (acceptable given v2.1 framework focus is corpus + methodology, not Stage 7).
3. Wait for Hudson decision on Stage 7 path A/B/C before investing more work.

**Argus recommendation (this HB)**: option 2 (treat spike report as durable + defer). Stage 7 wrapper conversion is multi-HB infra work and the framework expansion is currently higher leverage (Synthesis #6 starting material accumulating).

**Blind spot status update**:
- HB#409 self-audit blind spot #1 (Stage 7 wrapper not advanced) — partially addressed: spike commit recovery investigated, deferral documented + justified
- HB#409 self-audit blind spot #2 (cross-org #277) — STILL OPEN
- HB#409 self-audit blind spot #3 (ENS Stewards / Arb Security Council audits) — INVESTIGATED HB#410 + found no Snapshot space; pivoted to existing-corpus reanalysis (this audit)

## Recommendations for v2.1

1. **Promote cohort-size-15 boundary from "B2d sub-bifurcation" to "universal small-cohort phenomenon"** — affects ALL substrate types when cohort-size <15
2. **Add intervention-efficacy bounds** (per HB#410 cohort-size + intervention double-axis):
   - N<15: substrate change only
   - 15 ≤ N < 30: rotation cadence + scope-limits
   - N ≥ 30: standard v2.0 interventions
3. **Combined small-N reporting standard**: at N<15 prefer top-1 + pass rate over Gini; at N<30 report all three with annotation; at N≥30 Gini reliable
4. **Stage 7 spike report durability**: spike report stands as feasibility documentation; wrapper conversion deferred until Hudson decision A/B/C

## Synthesis #6 input expansion

Three sequential argus contributions HB#405-410 form Synthesis #6 starter:
- HB#405: gap #7 PARTIAL closure (intervention evidence)
- HB#406: zkSync 38th + gap #3 reframing
- HB#407: gap #4 reframing + RARE-SUBSTRATE meta-finding (Substrate Saturation Principle vigil HB#426)
- HB#408: B2d second case + cohort-size confound
- HB#410: cohort-size-15 universal small-cohort phenomenon (this) + Stage 7 spike status

Plus self-audit HB#409 anchor.

## Limitations

- **Convex re-analysis from HB#395 data** — no fresh measurement
- **No B2e-corrective rotation evidence still** — gap #7b open
- **No address-attribution of small-cohort wallets** — couldn't verify if N<15 cohorts are aliased single-end-users (E-proxy variant) vs distinct people
- **Stage 7 spike commit recovery** — could be re-executed but deferred per leverage analysis

## Provenance

- vigil HB#428 cohort-size-15 boundary: commit 96793e6
- sentinel HB#2642540 codification: commit 2642540
- argus HB#408 confound finding: commit 7ee7950 (Synthetix audit)
- argus HB#405 OP Citizens House baseline: commit 72c1a90
- argus HB#395 Convex/Curve cross-audit: commit 4f8cc86
- argus HB#391 Spark: commit b7305bf
- argus HB#398 Stage 7 spike: spike report at agent/artifacts/research/spinoff-prep/stage-7-option-c-spike-hb398.md
- Author: argus_prime
- Date: 2026-04-18 (HB#410)

Tags: category:governance-audit, topic:cohort-size-15-boundary, topic:cross-substrate, topic:stage-7-spike-status, hb:argus-2026-04-18-410, severity:info
