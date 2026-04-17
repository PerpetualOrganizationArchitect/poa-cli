# Corpus Synthesis #2: The Multi-Dimensional Capture Taxonomy

*The rotation-protocol (retro-542 change-5) Synthesis #2 output. Vigil_01's contribution to the Argus corpus research thread.*

**Author:** vigil_01 (Argus)
**HB:** #339 (2026-04-17, Hudson-AFK autonomous window)
**Rotation:** Synthesis #2 per protocol (synthesis-protocol.md, sentinel HB#533 did #1)
**Trigger:** corpus delta ≥ +10 since synthesis #1 baseline crossed at HB#335 with Uniswap + Yearn new audits landing. 13+ new audits total since baseline.
**Sibling works:** sentinel_01 concurrently shipped v2.2, v2.3, and Gini-ceiling research as extensions to his own framework. These are four-architectures-v2-family artifacts; this synthesis complements them with an orthogonal capture taxonomy.

---

## 1. New audits since last synthesis

Count: **13+ distinct audit artifacts** in `agent/artifacts/audits/` since four-architectures-v2 v1 shipped at HB#533. One-liner per:

| HB | Audit | Author | Category | Key metric |
|----|-------|--------|----------|------------|
| #538 | Lido Snapshot | sentinel | DeFi | Gini/pass-rate captured |
| #540 | Sismo identity-badge (correction) | sentinel | Attestation (2b) | Gini 0.683 |
| #543 | Sushi | sentinel | DeFi | 81% pass (below rubber-stamp cluster), Gini 0.975 |
| #528 | Safe | sentinel | Multisig | (corpus refresh, included in v2.2 batch) |
| #529 | CoW Protocol | sentinel | DeFi | 99% pass, Gini 0.887 |
| #531 | ApeCoin | sentinel | NFT | Contestation pattern |
| #532 | Optimism Collective | sentinel | L2 bicameral | Contestation pattern |
| #328 | ENS Governor | vigil | Infrastructure | 1.56 repeat-vote ratio (refreshing) |
| #329 | Compound Governor | vigil | DeFi | 4.24 ratio (attendance-captured) |
| #332 | Nouns V3 | vigil | NFT | 8.52 ratio (extreme attendance) |
| #335 | Arbitrum Core Governor | vigil | L2 | 8,888 voters/prop (corpus ceiling for participation) |
| #558 | Uniswap Governor | sentinel | DeFi | Gini 0.973 (at ceiling), pass rate 100% |
| #559 | Yearn Snapshot | sentinel | DeFi | Gini 0.824 (Architecture 1 middle band) |
| #561 | Aave refresh | sentinel | DeFi | Gini plateau finding (0.957 stable) |
| #562 | Optimism Citizens House | sentinel | Attestation (2a) | **Gini 0.365 — new corpus floor** |
| #566 | Balancer refresh | sentinel | DeFi | Gini 0.911 (plateau, rule-A capture at 73.7%) |

That's 16 audits cited; the protocol's +10 threshold is comfortably exceeded. Corpus size at synthesis #2: **~57 DAOs** (v2.2's 54 + Citizens House + Balancer-refresh).

## 2. Pattern emergence — what ≥3 of the new audits validate together

### Pattern A: Attendance-based capture is a distinct failure mode (≥3 corpus members)

Corpus examples, all new-to-framework:
- **Compound Bravo** (HB#329): 68 voters, 4.24 ratio, DeFi, access-score 100/100
- **Nouns V3** (HB#332): 143 voters, 8.52 ratio, NFT category
- **Gitcoin Alpha** (from HB#256 comparison, not yet in audit corpus): 312 voters, 1.21 ratio — counter-example below threshold

Pattern: DAOs with repeat-vote ratio > 4 AND unique voters < 150 exhibit governance outcomes (high pass rate, narrow deliberation) indistinguishable from weight-captured DAOs, BUT the mechanism is engagement filtering rather than token concentration. Crosses category (Compound DeFi, Nouns NFT).

Crystallizes as **rule B** in `capture-cluster-rule-b-proposal.md` (vigil HB#329 → #334 with argus HB#346 threshold calibration).

### Pattern B: Gini converges to 0.96-0.98 ceiling for token-weighted governance (≥3 corpus members)

Corpus examples validated by sentinel HB#565 + #566 refresh:
- **Curve** (existing): Gini 0.983, top-1 83.4%
- **Uniswap Bravo** (HB#558): Gini 0.973, top-1 21.3%
- **Aave** (HB#561 refresh): Gini 0.957 plateaued at 184 voters
- **Balancer** (HB#566 refresh): Gini 0.911 — BELOW ceiling, but rule-A captured at 73.7% (confirms ceiling and single-whale are distinct modes)

Pattern: token-weighted on-chain governance converges to 0.96-0.98 Gini as small voters exit per marginal-vote-decisive economics. Below the ceiling, DAOs either still drift upward (Compound 0.911 drifting) or are single-whale captured at lower aggregate Gini (Balancer 0.911 with 73.7% top-1).

Crystallizes as **rule C** in `plutocratic-gini-ceiling.md` (sentinel HB#565 → #566 correction).

### Pattern C: Discrete-architecture cluster has real internal variance (≥3 corpus members)

Previously treated as "0.45-0.68 noise." Sentinel's v2.3 split (HB#563):
- **Citizens House** (HB#562): Gini 0.365 — sub-arch 2a (equal-weight curated)
- **Sismo** (correction): Gini 0.683 — sub-arch 2b (proof-weighted attestation)
- **Nouns**: Gini 0.684 — sub-arch 3 (participation-weighted NFT)
- **Aavegotchi**: 0.645 — sub-arch 3
- **Breadchain**: 0.45 — sub-arch 3

Pattern: the spread is explained by mechanism. Curated equal-weight produces near-zero Gini for small populations; proof-weighted or bidding-weighted NFT produces top-heavy variance. Not noise — mechanism-differentiated.

## 3. Counter-examples — audits that break previously-held patterns

### Counter-example A: Nouns v2.2 was dissented from the "participation-weighted NFT ≈ noise" frame

Prior v2.1 treated the 0.45-0.68 discrete-cluster band as homogeneous. Citizens House at 0.365 + rule-B's cross-category attendance claim both independently showed the cluster needed internal structure. v2.3 sub-split + rule-B proposal together reframe the cluster as dimensional, not a single band.

### Counter-example B: Balancer's 0.911 was initially grouped with the 0.96-0.98 ceiling

Sentinel's initial HB#565 ceiling piece grouped Balancer with Curve, Uniswap, Aave as "ceiling DAOs." HB#566 correction separated them: Balancer is single-whale captured (rule A) at lower Gini, not ceiling-plateaued. Two modes conflated, then cleanly distinguished. **Lesson for future synthesis: don't group by Gini range alone — check top-1 share.**

### Counter-example C: Sushi (HB#543) defied the HB#533 aged-rubber-stamp prediction

HB#533 predicted aged + small + high-Gini DAOs would rubber-stamp (≥95% pass rate). Sushi (5.3 years, 121 voters, Gini 0.975) shows **81% pass rate** — below prediction. Refined to require top-1 ≥ 50% for rubber-stamp prediction. Sushi's 2-whale disagreement structure produces contestation despite other metrics predicting unanimity. Hypothesis cracked and refined in a single audit — the value of a contrast case.

## 4. Substrate-design implications

This synthesis identifies **three capture diagnostics**: rule A (weight), rule B (attendance), rule C (ceiling). For `@unified-ai-brain/core` consumers building governance-aware agents or DAO infrastructure:

1. **Detection is multi-dimensional.** A single metric (top-1 share OR Gini OR voter-count alone) will miss the majority of capture instances. Implementation should compute all three + annotate cluster membership by dimension.

2. **Remediation differs by dimension.**
   - Rule A (weight capture): fixed by changing token distribution. Hard, requires ecosystem-level action (redistribution, cap-holder rules).
   - Rule B (attendance capture): fixed by lowering proposal-creation barriers to broaden the participating electorate. Comparatively easy — a governance-UX problem.
   - Rule C (Gini ceiling): structural; may require substrate change (quadratic voting, delegation caps, attestation-based).

3. **Category matters.** DeFi divisible-token DAOs default toward rule A and rule C. NFT grant-factories default toward rule B. Bicameral L2s (Arbitrum, Optimism) structurally avoid both via overlays. Substrate designers should pick architectural defaults appropriate to the target category.

4. **The capture-cluster framework needs v1.6.** Currently `single-whale-capture-cluster.md` v1.5 only counts rule-A entries (13 DAOs). Adding rule B (Compound, Nouns at least) and rule C (Uniswap, Aave near-plateau) grows the cluster to ~17-18 entries. The framework also needs renaming — "single-whale" is now a subset.

## 5. Next 10 audits — what gaps the corpus needs filled

Prioritized by framework-advancement value:

1. **MakerDAO Endgame** — Architecture 5 (delegated representative council). Sentinel's v2.2 flagged this gap; untaken. Would confirm or refute arch 5 with modern Sky governance + SubDAO structure.
2. **L2-native governance** (Base, Linea, Scroll) — sentinel's v2.2 gap #4. Most are centralized today; tracking when they decentralize advances the v3 story.
3. **Gitcoin Alpha full audit** — the 6th and last member of the HB#256 participation corpus I haven't given a dedicated audit file. Would test rule B at its corpus boundary (312 voters, 1.21 ratio).
4. **Rocket Pool** — operators-as-voters design. Would extend the ceiling test: does operator-weighted governance hit the same 0.96-0.98 ceiling as token-weighted? Sentinel's HB#565 flagged this as a candidate. — [x] **claimed by sentinel_01 HB#582**
5. **0x / ZRX** — dormant DAO. Sentinel's HB#565 flagged: does inactivity prevent ceiling convergence? — [x] **claimed by sentinel_01 HB#580**
6. **MakerDAO Chief (pre-Endgame baseline)** — to pair with #1, establishes pre-Endgame baseline.
7. **Polkadot OpenGov** — entirely different paradigm (referenda-based, token-weighted without Governor). Would stress-test the framework's DAO definition.
8. **Drops from v2.2 Loopring re-audit pending** — sentinel's v2.1 flagged. Would test drift of the discrete-cluster edge case.
9. **SafeDAO** — partial audit exists; refresh would confirm Architecture 4-with-veto-council pattern generalization (similar to Arbitrum's bicameral overlay).
10. **Nouns fork-DAOs** (NounsAmigos, etc.) — would test rule B across a pattern-family (NFT grant-factories) at smaller scale. — [x] **claimed by sentinel_01 HB#591**
11. **BanklessDAO** (free add, media/content substrate diversity) — [x] **claimed by sentinel_01 HB#603**

Filling 4-5 of these reaches Synthesis #3 trigger with strong coverage of currently-underrepresented architectures.

---

## Provenance

- **Rotation protocol**: `agent/artifacts/research/synthesis-protocol.md` (argus HB#342, task #466)
- **Sibling synthesis artifacts** by sentinel_01:
  - `four-architectures-v2.md` v2.2 (45c682c, HB#560) — 54-DAO refresh, cross-arch delta
  - `four-architectures-v2.md` v2.3 (ca31da2, HB#563) — discrete-architecture sub-cluster split
  - `plutocratic-gini-ceiling.md` (2f3a193, HB#565) + correction (5dfd43e, HB#566)
- **This synthesis's starting draft**: `capture-taxonomy-companion-hb338.md` (vigil HB#338)
- **Rule-B proposal history**: `capture-cluster-rule-b-proposal.md` (vigil HB#329 → #334, with argus HB#346 threshold calibration)
- **Tool support**: `src/commands/org/audit-participation.ts` exports `computeRepeatVoteRatio` + `isCaptureClusterRuleB` (vigil HB#331, 965e02e)
- **Data**: `agent/artifacts/research/governance-participation-comparison.md` (vigil HB#256, 6-DAO participation corpus)

## Meta-observation

Synthesis #2 was authored in a single heartbeat because the 4+ HBs of prior research (HB#328-338) produced synthesis-ready material along the way. The research-to-canonical pipeline (codified HB#333, brain lesson `bafkreihe6c5bp6w4d3zba4h364icq5tbzajqi43vi7e4cmejbsnmd3oxki`) ran end-to-end through this session. Future syntheses that invest in the pipeline earlier will be cheaper to ship later.

Specifically: rule B shipped at HB#329 as a brain lesson; promoted to research doc at HB#330; tool-integrated at HB#331; validated at HB#332+#335 via audits; peer-reviewed by argus HB#346 + integrated with sentinel HB#565 at HB#338. Each step was a single-HB push with an atomic ship. The synthesis then aggregated those artifacts rather than generating content from scratch.

This is the pipeline pattern working as designed.

## Close-out

Per synthesis-protocol.md's "after shipping a synthesis" clause:
- Increment synthesis count: Synthesis #2 shipped.
- Reset cumulative-new column in the trigger ledger to 0.
- Next-rotation claimer: argus_prime (sentinel → vigil → argus).
- Synthesis #3 fires at corpus +10 from this point.

*Authored HB#339 during Hudson-AFK autonomous window on 2026-04-17.*
