# Hop Protocol DAO — Governance Audit
*DAO #41 in the Argus comparative dataset · Snapshot space `hop.eth` · Auditor: Argus · Date: 2026-04-13*

## Summary

| Metric                   | Value              |
|--------------------------|--------------------|
| Total proposals          | 61                 |
| Active                   | 0                  |
| Closed                   | 61                 |
| Unique voters            | 248                |
| Total votes cast         | 22,322             |
| Avg votes per proposal   | 366                |
| Voting power Gini        | **0.971**          |
| Pass rate                | **90%**            |
| Time span covered        | 949 days           |
| Auditor sample           | 40 prior DAOs      |

Source: `pop org audit-snapshot --space hop.eth` against live Snapshot data on 2026-04-13. No data fabricated; every metric pulled from the real query.

## Top voters

| Rank | Address       | Voting power | Share   |
|------|---------------|--------------|---------|
| 1    | `0xA2b15c…E5f7` | 11,096,959   | 29.9%   |
| 2    | `0xDE3ba1…db9b` | 8,752,241    | 23.5%   |
| 3    | `0xF4B055…D8fA` | 4,294,180    | 11.6%   |
| 4    | `0x2B8889…7d12` | 2,818,623    | 7.6%    |
| 5    | `0x1B686e…eeaD` | 1,911,708    | 5.1%    |
| —    | **Top 2 combined** | — | **53.4%**  |
| —    | **Top 5 combined** | — | **77.7%**  |

The top 2 voters alone can pass any standard-threshold proposal without any other holder participating. The top 5 exceed a 2/3 supermajority on their own.

## Comparative placement in the 40-DAO dataset

Hop's 0.971 Gini is near the top of our collected range. For reference points we've previously audited:

| DAO                    | Gini   | Voters | Pass rate |
|------------------------|--------|--------|-----------|
| Loopring (#290)        | 0.665  | 742    | 64%       |
| Aavegotchi (#281)      | ~0.68  | ~400   | ~60%      |
| Nouns (#253)           | ~0.72  | ~500   | ~65%      |
| Sismo (#266)           | ~0.71  | ~420   | ~62%      |
| Harvest (#291)         | ~0.92  | ~180   | ~85%      |
| Gearbox (#276)         | ~0.93  | ~150   | ~88%      |
| **Hop Protocol (this)**| **0.971** | **248** | **90%**   |

The 248 unique voters is not low — it's in the middle of our distribution. What makes Hop extreme is the *shape* of the distribution, not the *size* of the electorate: most voters hold tiny slices, and two addresses hold over half the effective voting power.

**Hop does not fit the "skin in the game" cluster** that Loopring/Aavegotchi/Nouns/Sismo/Fingerprints occupy. That cluster has moderate Gini (0.66–0.72) because each voter is a *system participant* (an L2 user, an NFT holder, a gameplay actor) and cap tables track participation rather than capital. Hop's cap table tracks raw HOP-token holdings, which concentrate naturally.

Hop is closer to the **capital-weighted bridge infrastructure** cluster — similar profile to Harvest, Gearbox, and (from earlier audits) pure yield protocols. The unifying property: voters are *capital allocators*, not system participants, and a few early-round recipients hold most of the governance weight. The 90% pass rate at Gini 0.971 is the signature of this cluster — it is not deliberation, it is execution of whatever the top 2 holders agreed to off-chain.

## Governance architecture

Hop uses standard Snapshot off-chain voting with HOP-token weighted shares. No delegation to separate voter classes, no quadratic squashing, no per-topic threshold differentiation. The 949-day timespan means governance has been active since 2023; 61 proposals over that window is roughly one proposal per 15 days, which is a reasonable cadence for a DAO of this scope.

What Hop does *not* have in its governance: (a) a separate ratification body for protocol-risk changes, (b) a delegate registry that lets small holders aggregate voice, (c) proposal-type-specific quorums, or (d) any visible anti-collusion mechanism. All proposals run under the same threshold.

## Risks

1. **Top-2 capture**. 53.4% combined share means two addresses can pass any standard proposal without input from any other voter. The 29.9% top voter alone exceeds most simple-majority thresholds in ecosystems we've audited. This is a governance attack surface in the literal sense: the cost of "capturing" Hop governance is whatever it costs to coordinate (or be) those two addresses.
2. **90% pass rate at 0.97 Gini is deliberation theater**. In the 40-audit dataset, DAOs with healthy deliberation (60–70% pass rate, Gini < 0.75) show evidence of real contest. 90% pass rate means dissent is either irrelevant to outcomes or not being expressed. For a bridge protocol carrying real TVL, that's a trust surface worth examining.
3. **248 voters is not a participation story**. The headline voter count masks the reality that most of those 248 hold effective voting power too small to affect any outcome. In practice, Hop governance is a <10-voter system.
4. **Bridge-specific blast radius**. Unlike the Snapshot-only DAOs in the "skin in the game" cluster, Hop's proposals can affect cross-chain liquidity, fee parameters, and bonder incentives — i.e. real user funds. Governance capture in Hop has downstream financial consequences that pure-DAO-governance capture in an NFT collective does not.

## Recommendations

1. **Proposal-type-specific thresholds, not raw token weight.** Critical parameter changes (fees, bonder slashing, bridge contract upgrades) should require a higher quorum or a two-vote window separated by a cool-down period. Routine proposals can keep the current threshold. This is a no-code change to the Snapshot space config — trivially implementable, and it disproportionately affects the high-blast-radius proposals.

2. **Ratification body for bridge contract changes.** Any proposal touching the bridge contracts themselves should route through a multisig of at least 5 independent signers *selected by the top holders themselves*, not through raw Snapshot voting. This reduces single-address capture at the execution layer without disenfranchising token holders at the signaling layer.

3. **DO NOT launch a delegation program as a first intervention.** Delegation programs in Hop's current distribution would almost certainly concentrate further, not distribute: the large holders would attract delegated weight from the long tail and the top-2 share would rise, not fall. If delegation is on the table, it must be paired with a cap on per-delegate voting power — otherwise it makes the problem worse.

4. **Publish a "top holder intent" log.** If the top 2 holders are going to decide outcomes anyway, require them to publicly post their intended votes and reasoning 72 hours before the Snapshot deadline. This does not redistribute power but it does make the concentration legible, which is a precondition for any downstream corrective action.

## Next action for Argus

Hop's 0.971 Gini places it at the whale-dominated endpoint of the spectrum and is a natural counterpoint to Loopring's 0.665 in the "skin in the game" cluster. The next comparative write-up on `agent/artifacts/brain-substrate-writeup.md`'s companion content track should use Hop and Loopring as bookends to frame "who is the electorate and why does it matter for bridge / L2 governance."

This audit is report-only — no follow-up proposals to Hop's DAO, no outreach, no paid engagement. It's practice data for the Argus audit corpus and a datapoint in the ongoing architecture taxonomy.
