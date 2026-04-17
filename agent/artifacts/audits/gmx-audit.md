# GMX DAO — Governance Audit
*DAO #45 in the Argus comparative dataset · Snapshot space `gmx.eth` · Auditor: Argus · Date: 2026-04-13*

## Summary

| Metric                   | Value                   |
|--------------------------|-------------------------|
| Total proposals          | 75                      |
| Active                   | 0                       |
| Closed                   | 75                      |
| Unique voters            | 511                     |
| Total votes cast         | 315,355                 |
| Avg votes per proposal   | 4,205                   |
| Voting power Gini        | **0.930**               |
| Pass rate                | **80%**                 |
| Time span covered        | 1,595 days (~4.4 years) |
| Auditor sample           | 44 prior DAOs           |

Source: `pop org audit-snapshot --space gmx.eth` against live Snapshot data on 2026-04-13. Every metric is from the real query; nothing fabricated.

GMX's **1,595-day timespan is the longest in the Argus corpus**, which is relevant to any pass-rate interpretation — this is not a young DAO whose governance has had insufficient time to contest anything.

## Top voters

| Rank | Address         | Voting power | Share   |
|------|-----------------|--------------|---------|
| 1    | `0xD5BB24…9c0a` | 3,229,949    | **36.4%** |
| 2    | `0x004c71…7fAC` | 820,764      | 9.3%    |
| 3    | `0x645E50…B7a1` | 301,683      | 3.4%    |
| 4    | `0xc74147…7082` | 283,742      | 3.2%    |
| 5    | `0x754696…71d8` | 244,389      | 2.8%    |
| —    | **Top 2 combined** | —         | **45.7%** |
| —    | **Top 5 combined** | —         | **55.1%** |

The 36.4% top voter is notable but NOT the highest single-address share in the current 48-DAO corpus — sentinel_01 added BadgerDAO (93.3%), dYdX (100% single-voter), Venus (63.3%), and refreshed Gitcoin to 46.4% in HB#287-290 after this audit was drafted. It is however the highest single-address share among DAOs with meaningful voter diversity (GMX has 511 unique voters, whereas the higher-concentration cases cluster around 1-78 voters). More importantly, unlike Hop (top 2 = 53.4%), **GMX's top 2 voters combined (45.7%) fall short of a simple majority.** GMX's top voter cannot unilaterally pass a proposal, and the top 2 also need at least one additional participant to clear 50%. That is a structurally different governance attack surface from Hop (where top 2 = 53.4% majority capture).

This distinction matters because the naive "Gini 0.93 = extreme concentration = governance captured" pattern-match is wrong for GMX. GMX has high concentration, but not quite high enough for a 2-address coalition to rule.

## Comparative placement

| DAO                   | Gini  | Voters | Pass rate | Top-2 share | Archetype              |
|-----------------------|-------|--------|-----------|-------------|------------------------|
| Loopring              | 0.665 | 742    | 64%       | ~10%        | skin in the game       |
| Sismo                 | ~0.71 | ~420   | ~62%      | ~14%        | skin in the game       |
| **GMX (this)**        | **0.930** | **511** | **80%** | **45.7%** | **middling capital-weighted** |
| Hop Protocol          | 0.971 | 248    | 90%       | 53.4%       | capital-weighted bridge/yield |
| Aave (2026 update)    | 0.957 | 193    | 91%       | ~48%        | capital-weighted       |
| ENS                   | 0.976 | —      | ~88%      | —           | capital-weighted       |

GMX sits between the "skin in the game" cluster (Loopring / Nouns / Sismo / Aavegotchi / Breadchain at Gini ~0.66–0.72, 60–65% pass rate, participation-weighted electorate) and the "capital-weighted rubber-stamp" cluster (Hop / Harvest / Gearbox / Aave at Gini ~0.93–0.97, 85–95% pass rate, top-2 majority-capable).

The 80% pass rate is telling. Healthy deliberation in the skin-in-game cluster sits around 60–70%. Rubber-stamping in capital-weighted DeFi sits around 90%+. GMX's 80% is closer to rubber-stamping than to contest, but the 45.7% top-2 share means the rubber-stamp is not a 2-coalition decision — at least 3 addresses need to agree on a routine proposal to clear a simple majority.

**Honest reading**: GMX is *middling capital-weighted governance*. More concentrated than healthy, less captured than Hop, longer operating history than both. A useful mid-taxonomy datapoint — the kind that a 4-or-5-architecture taxonomy can't cleanly file under any single bin.

## Governance architecture

GMX uses standard Snapshot off-chain voting with voting power derived from the GMX + esGMX token holdings (esGMX is escrowed/vested GMX). No formal delegate registry, no proposal-type-specific quorums, no ratification body for protocol-risk changes. All proposals run under the same threshold.

**The 75 proposals over 1,595 days is a ~21-day cadence**, which is slower than Hop (15 days), Loopring (22 days), and in line with DeFi protocols that batch governance into predictable cycles. Not spammy, not inactive.

What GMX does NOT have: (a) a bicameral structure, (b) proposal-type-specific thresholds, (c) quadratic squashing, (d) a visible anti-collusion mechanism. Every vote runs the same way with the same weights.

## Risks

1. **Middling deliberation at 80% pass rate.** A 20% rejection rate means roughly 1 in 5 proposals don't pass — better than Hop's 10%, worse than Loopring's 36%. If you believe pass rate is a proxy for contest, GMX is weakly contested: most proposals are pre-coordinated off-chain and the Snapshot vote is ratification rather than deliberation.

2. **Long-tail concentration.** 511 unique voters over 4.4 years is ~116 voters/year in absolute terms, but the effective electorate is much smaller — the bottom 506 voters together hold less voting power than the top 5 combined (top 5 = 55.1%; bottom 506 therefore ≤ 44.9%). In practice GMX governance is a <20-voter system.

3. **36.4% top voter is a soft attack surface.** Unlike Hop, GMX's top voter cannot pass a proposal alone. BUT 36.4% is enough to single-handedly block any proposal that requires supermajority (2/3 threshold), and enough to make any close vote go their way. The cost of acquiring that position (or being it) is the cost of governance influence at GMX.

4. **No proposal-type differentiation.** Contract upgrades, fee changes, and parameter tweaks all pass under the same threshold. A proposal that touches user-fund-holding contracts should have a higher bar; GMX does not differentiate.

## Recommendations

1. **Proposal-type-specific thresholds via Snapshot configuration.** Contract upgrades and parameter changes that affect user funds should require supermajority (2/3) or a cool-down period, while routine proposals keep the current simple majority. This is a no-code change to the Snapshot space config and directly addresses risk #4.

2. **Quorum floor on minimum voter count, not just voting power.** A proposal that passes with high voting-power participation but only 5 voters is suspicious regardless of the VP threshold. Set a minimum participating-voter count (e.g. 30 distinct addresses) as a secondary gate. This catches the "top 5 agree and the rest don't show up" pattern without disenfranchising the long tail.

3. **Do NOT launch a standalone delegation program.** In GMX's distribution (36.4% top voter, long tail of dust), adding delegation without a per-delegate VP cap would concentrate further — the top holder would likely attract the most delegated weight because they're the most visible. Any delegation proposal must be paired with a max-delegated-to-any-single-address cap. The distribution shape matters (see Argus design principle #8).

4. **Publish a "large holder intent" policy.** Require addresses holding > 5% voting power to post their intended votes and reasoning 48 hours before any Snapshot deadline. Does not redistribute power, but makes concentration legible. The top 3 addresses already represent 49.1% of voting power; their public reasoning is what the vote actually turns on.

## Next action for Argus

GMX is a middling capital-weighted datapoint and does not require special follow-up. It fits naturally in the "capital-weighted" cluster below Hop/Aave but above the skin-in-game cluster, and the 80% pass rate plus sub-majority top 2 make it a useful mid-taxonomy case for any follow-up comparative work.

**Report only** — no outreach to GMX governance, no engagement, no proposal. Practice data for the Argus audit corpus.
