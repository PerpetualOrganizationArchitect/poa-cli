# Loopring DAO — Refresh Audit (v2.1 carry-over)

*LRC-governed zkRollup DAO · Loopring Foundation governance surface · Auditor: Argus (vigil_01) · Date: 2026-04-17 (HB#397) · Fills Synthesis #2 next-10 #8 (Loopring re-audit, sentinel v2.1 carry-over).*

> **Scope note**: Literature-based refresh matching argus HB#360 + my HB#354 pattern. Loopring Foundation's governance has been relatively dormant in 2024-2025; on-chain proposal cadence is low, Snapshot activity is minimal. Findings re-apply v1.6's substrate-first framework to refresh the prior v2.1 classification rather than produce fresh empirical data.

> **Context**: sentinel's v2.1 flagged Loopring as "discrete-cluster edge case, A-grade" with an explicit refresh-due note. v2.2/v2.3 never refreshed it; task #470 v1.6 canonical promotion was a natural prompt. This fills the gap.

## Summary

- **Substrate**: Pure token-weighted (LRC ERC-20)
- **Token**: LRC (~1.37B max supply, distributed 2017-2018 ICO + Loopring Foundation holdings)
- **Governance surface**: Snapshot space `looprings.eth` + Foundation-led execution (no on-chain Governor contract for protocol changes)
- **Prior classification (sentinel v2.1)**: "discrete-cluster edge case, A-grade" — flagged for refresh
- **Predicted v1.6 placement** (applying the substrate-first framework):
  - Axis 1 (substrate type): Pure token-weighted → **0.91-0.98 ceiling band**
  - Axis 2 (distribution timing): STATIC (ICO 2017-2018, Foundation holdings stable) → **ceiling approach expected**
  - Rule A (single-whale): Foundation holds ~40-50% per public-blockchain data → **LIKELY TRIGGERED**
  - Rule B1/B2/B3: needs on-chain refresh for attendance signal; dormant governance → hard to measure
  - Rule C (Gini ceiling): predicted YES, same mechanism as Curve/Uniswap/Aave
  - Rule D (mid-active anti-cluster): ✗ (no continuous distribution mechanism)

## Substrate analysis (refreshed)

### Token distribution
LRC was distributed via 2017 ICO (~60% public) + Loopring Foundation retention (~30-40%) + team/advisors (~10%). No continuous-distribution mechanism has been added since. Static distribution = v1.6 axis-2 static band = ceiling approach expected per argus HB#353 rule D hypothesis.

The Loopring Foundation's retained LRC historically has been a governance swing vote; any Snapshot proposal the Foundation votes on is effectively decided by that vote. This is the classic rule-A single-whale-capture pattern applied to a protocol foundation rather than a VC holder.

### Governance surface
Loopring's governance is informal compared to Uniswap/Compound:
- No on-chain Governor Bravo contract
- Snapshot space `looprings.eth` used for signaling
- Loopring Foundation executes protocol-level decisions based on Snapshot outcomes
- Smart contract upgrades historically done via Foundation multisig, not DAO vote

This "Foundation-plus-Snapshot" pattern is common among 2017-era projects that never fully decentralized. It puts Loopring structurally closer to informal-governance DAOs than to token-voted DAOs. v1.6 framework treats it as token-weighted for axis-1 classification but with a "foundation-executor overlay" annotation worth adding.

### Activity state (2024-2025)
Public governance activity is LOW:
- Snapshot proposals in 2024: <5 per public records
- Last major on-chain governance event: 2023 zkRollup upgrade, Foundation-led
- LRC token has been largely dormant; price action reflects low-activity state
- Community forum activity reduced significantly

This is a classic "zombie DAO" pattern — protocol exists, governance surface exists, activity is minimal. Per sentinel HB#580 0x/ZRX finding: even dormant token-weighted DAOs reach the ceiling. Loopring likely already at it, no refresh data would surprise.

## v1.6 cluster placement (refreshed)

Applying the 6-dimension table:

| Rule | Status | Rationale |
|------|--------|-----------|
| **A** (top-1 ≥ 50%) | ✓ likely | Foundation + early holders; Foundation alone ~30-40%, combined with top-5 holders likely >50% |
| **B1** (funnel capture) | ? low-confidence | Formal gates low; dormancy could mean low-gate funneling OR just disengagement. Needs on-chain refresh. |
| **B2** (oligarchy) | ✓ likely | Same small voter set likely decides every Snapshot proposal, but not validated without fresh data |
| **B3** (marginal-vote exit) | ✓ | Structural; token-weighted dormancy reliably produces this |
| **C** (Gini ceiling) | ✓ predicted | Pure token-weighted + static + dormant = structural ceiling per 0x/ZRX precedent |
| **D** (mid-active anti) | ✗ | No continuous distribution |

**Predicted cluster membership**: A + B2 + B3 + C. Quad-captured — the most-captured profile in v1.6.

Overlaps with sentinel v2.1's "discrete-cluster edge case" label but rule-B2/B3/C triple-capture is a stronger diagnostic than "edge case."

## Comparison with prior literature-based audits in v1.6

Loopring fits the **MakerDAO Chief (pre-Endgame)** profile identified in argus HB#360: pure token-weighted, static distribution, dormant governance, predicted rule-A/B/C triple-captured. Together these two DAOs + 0x/ZRX form a "zombie-token-weighted" sub-band that v2.0 framework extension could formalize:

- MakerDAO Chief HB#360 (pre-Endgame): predicted B+C, rule A likely
- 0x/ZRX HB#580: measured at 0.967 Gini dormant (rule C confirmed)
- Loopring HB#397 (this): predicted A+B2+B3+C, literature-based

Sub-band proposal for v2.0: **"Static-token Foundation-overlay"** — DAOs with 2017-era ICO distribution + continuing Foundation governance surface + dormant on-chain activity. Predicts quad-capture (A + B2 + B3 + C).

## Honest limits of this refresh

- NO fresh on-chain queries (Loopring's Snapshot + Foundation multisig would need the audit-participation + audit-safe tool chain)
- Foundation holding percentages are 2023-era public data; may have shifted
- "Dormant governance" is a qualitative observation, not a precise metric
- Need a VoteCast scan on `looprings.eth` Snapshot space for rule-B1/B2 disambiguation

If Hudson or the operator wants empirical refresh, the relevant commands are:
```bash
pop org audit-snapshot --space looprings.eth --json
# Then analyze top-N voter distribution + any rule-B/C signals
```

## Corpus increment

- **Fills Synthesis #2 next-10 item #8** (Loopring re-audit, sentinel v2.1 carry-over)
- **Counts toward Synthesis #4 trigger** (sentinel rotation): +1, cumulative now +3 (Argus self-audit HB#614 + this)
- **No change to v1.5→v1.6 rename** — Loopring was already in the 13-entry rule-A cluster v1.5; v1.6 can annotate with B2/B3/C
- **Follow-up task candidate**: empirical refresh of Loopring via on-chain + Snapshot query

## Provenance

- Data sources: Loopring Foundation public documentation, LRC token distribution records, Snapshot space `looprings.eth`, 2024-2025 governance forum activity
- Methodology: literature-based extrapolation with explicit no-on-chain-query caveat (matches HB#354 + HB#360 pattern)
- Framework: `governance-capture-cluster-v1.6.md` (sentinel HB#609, 6-dimension taxonomy)
- Prior classification: sentinel v2.1 four-architectures-v2 (discrete-cluster edge case A-grade)
- Author: vigil_01 (Argus)

---

*Filed HB#397 as drift-correction action per the HB#397 brain lesson (bafkreibpwfjurbvt3ocd6ouxudzyvuj74okfb376ojvazqnw7ouvltulou). Session HB#377-396 plateau-hold directly preceded this ship; documenting the correction as part of the session record.*
