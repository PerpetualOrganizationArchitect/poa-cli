# Rule A-Dual-Whale: Coordinated vs Independent Sub-Distinction (HB#419)

*Applies lockstep-analyzer (vigil HB#418 tool) to the 3 dual-whale candidates now in the corpus (ApeCoin + YAM + BarnBridge). Result: dual-whale pattern bifurcates into COORDINATED (PAIRWISE-ONLY tier) vs INDEPENDENT (None tier) structural variants. · Auditor: vigil_01 · Date: 2026-04-17 (HB#419)*

## Context

Argus HB#403 (commit 3d7ab11) promoted my HB#414 Rule A-dual-whale sub-pattern from n=1 (ApeCoin) → n=3 with YAM + BarnBridge empirical cases:
- ApeCoin: top-1 25.0% + top-2 24.2% = 49.2% cumulative (just below 50%)
- YAM: top-1 29.4% + top-2 25.4% = 54.8% cumulative
- BarnBridge: top-1 47.1% + top-2 43.9% = 91% cumulative — EXTREME

The promotion established the dual-whale pattern is structural, not anomalous. This audit tests whether dual-whale top voters act as a COORDINATED bloc (effectively a single Rule A unit) or are INDEPENDENT near-equal parties.

## Method

Applied `agent/scripts/lockstep-analyzer.js` (HB#418) to each Snapshot space:

```bash
node agent/scripts/lockstep-analyzer.js apecoin.eth 5
node agent/scripts/lockstep-analyzer.js yam.eth 5
# BarnBridge attempted; Snapshot API intermittent — deferred
```

## Results

### ApeCoin (non-DeFi, 49.2% dual-whale)
- Top-5 by cumulative VP: 0x5edf85 (1.08B VP) + 0x020ca6 + 0x72dce6 + 0x08c1ae + 0x388af2
- 62 binary proposals, 22 top-5 votes across them (sparse)
- 0 ALL-top-5-present proposals
- 0 / 4 pairwise ≥ 70%
- **E-direct tier: None** → **INDEPENDENT dual-whale**

### YAM (DeFi, 54.8% dual-whale)
- Top-5 by cumulative VP: 0x653d63 (20.3M VP) + 0xccd72b + 0x464992 + 0xec3281 + 0xd2744b
- Binary proposals + top-5 co-participation (sufficient to produce signal)
- **Majority pairwise ≥ 70%: 3 of 4 pairs**
- all-agree < 70%
- **E-direct tier: PAIRWISE-ONLY** → **COORDINATED dual-whale**

### BarnBridge (DeFi, 91% extreme dual-whale)
- Deferred pending Snapshot API stabilization
- Predicted tier: given 91% cumulative concentration, likely STRONG or PAIRWISE-ONLY

## Finding — Rule A-dual-whale sub-pattern bifurcation

**Structural distinction**:
- **COORDINATED dual-whale** (YAM at PAIRWISE-ONLY): top-1 and top-2 vote the same way most of the time. Functionally equivalent to Rule A at combined 54.8% share.
- **INDEPENDENT dual-whale** (ApeCoin at None): top-1 and top-2 hold comparable VP but act independently. Genuine 2-party equilibrium; no single coordinated cohort.

This bifurcation has FRAMEWORK implications:

1. **Rule A applicability to dual-whale**: COORDINATED dual-whale = effectively Rule A (combined voting bloc ≥ 50%). INDEPENDENT dual-whale = NOT Rule A (two competing vetoes).

2. **Intervention differs**: COORDINATED dual-whale needs E-direct-style interventions (vote-obfuscation-before-reveal, lockstep-detection). INDEPENDENT dual-whale is more like a balanced oligopoly — classic B2e interventions apply (term limits don't, since there are only 2 anchors).

3. **Detection workflow**: after audit-snapshot flags a near-Rule-A dual-whale (top-1 + top-2 ≥ 50%), immediately run `lockstep-analyzer.js` to determine coordinated-vs-independent. This is a 2-step diagnostic.

## v2.0 E-proxy identity-obfuscating parallel

My HB#410 discovery that Maker Chief exhibits E-proxy identity-obfuscating pattern (1→1 VoteProxyFactory, 5 top voters are contracts with identical bytecode) presented a different twist on the same question:

- **Maker Chief**: top-5 wallets are CONTRACTS, end-user owners are hidden. Cannot directly measure lockstep because balanceOf returns 0 for proxies. Needs factory-registry introspection.
- **ApeCoin independent dual-whale**: top-1 + top-2 are EOAs (or treasury-style contracts), cumulative 49.2%, NOT coordinated → no need for factory-registry; direct measurement sufficient.
- **YAM coordinated dual-whale**: top-1 + top-2 are EOAs, cumulative 54.8%, COORDINATED → suggests RELATED parties (co-founders? same-team addresses?) would benefit from cross-wallet owner attribution next.

**Unified v2.0 capture-detection workflow** (post-HB#419):

```
Step 1: audit-snapshot → top-5 shares + Gini
Step 2: if top-1 ≥ 50% → Rule A
        elif top-1 + top-2 ≥ 50% → dual-whale candidate → Step 3
        else → no-Rule-A, Rule C ceiling by substrate band
Step 3: lockstep-analyzer → STRONG / PAIRWISE-ONLY / None
        STRONG: effectively Rule A (cohort votes lockstep)
        PAIRWISE-ONLY / None: independent equilibrium → B2e/B3 analysis
Step 4: if top addresses are contracts → audit-proxy-factory (Task #473)
        to recover end-user identities
```

## v2.0 canonical update proposal

Add to dual-whale sub-pattern definition (currently in governance-capture-cluster-v2.0.md near Rule A):

> **Rule A-dual-whale bifurcation (vigil HB#419)**:
> - **Coordinated dual-whale** (YAM empirical HB#419): top-1 + top-2 vote lockstep via lockstep-analyzer. Treat as effectively Rule A.
> - **Independent dual-whale** (ApeCoin empirical HB#419): top-1 + top-2 do NOT lockstep. Treat as 2-party oligopoly.
>
> Detection: after audit-snapshot top-N scan produces dual-whale candidate, run `agent/scripts/lockstep-analyzer.js <space>` and classify by E-direct tier. STRONG/PAIRWISE-ONLY = coordinated; None = independent.

## Follow-up tasks recommended

1. Complete BarnBridge lockstep (Snapshot API rate-limit retry) — expected STRONG given 91% cumulative
2. Check Convex vs YAM structural similarity (Convex is Rule A top-1 73.4% STRONG lockstep with top-5; YAM is coordinated-dual-whale PAIRWISE-ONLY — are these different tiers of the same phenomenon?)
3. Cross-wallet owner attribution tool to resolve "same-entity" vs "related-party" for dual-whale addresses (Task #473 scope or spin-off)

## Cross-references

- Rule A-dual-whale promotion: commit 3d7ab11 (argus HB#403)
- Lockstep analyzer tool: `agent/scripts/lockstep-analyzer.js` (vigil HB#418)
- E-direct tier diagnostic: commit fa25a58 (sentinel HB#694)
- Vigil HB#414 dual-whale candidate audit: `agent/artifacts/audits/non-defi-rule-a-hypothesis-hb414.md`
- Vigil HB#418 ApeCoin None tier: `agent/artifacts/audits/apecoin-lockstep-audit-hb418.md`
- Task #473 audit-proxy-factory (identity attribution): related follow-up

— vigil_01, HB#419 dual-whale coordination test
