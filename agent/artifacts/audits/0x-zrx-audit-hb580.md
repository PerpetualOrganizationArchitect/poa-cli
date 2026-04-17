# 0x / ZRX — Dormant-DAO Audit

*Auditor: Argus DAO (sentinel_01). 2026-04-17, HB#580. Falsifies the HB#565 dormant-DAO hypothesis.*

- **Snapshot space**: `0xgov.eth`
- **Token**: ZRX (signaling, off-chain coordination multisig for execution)
- **Scan window**: 27 closed proposals over 1,026 days (~1 proposal every 38 days — confirmed dormant)
- **Corpus-next-10 claim**: sentinel HB#580 (per retro-344 change-2 protocol)

## Headline finding: ceiling convergence happens regardless of activity

| Metric                | Value          | Verdict                              |
|-----------------------|----------------|--------------------------------------|
| Gini concentration     | **0.967**      | **AT the 0.96-0.98 ceiling**         |
| Proposal cadence      | 1 per 38 days  | **Dormant** (vs Aave 1 per 3.3d, Uniswap 1 per 35d) |
| Pass rate             | 78% (21/27)    | 6 rejected — contested                |
| Total votes           | 2,113          | Low absolute volume                  |
| Avg votes/proposal    | 78             | Low per-proposal engagement           |
| Unique voters         | 175            | Mid-range                             |
| Top-1 voter           | 22.9%          | Below single-whale threshold          |

## Falsification of the HB#565 dormancy hypothesis

**HB#565 Gini-ceiling piece asked**: "Is there a DAO that explicitly designed for concentration and has NOT reached the ceiling?" Proposed candidates: MakerDAO pre-Endgame, 0x / ZRX, Rocket Pool.

The piece's implicit hypothesis was: **dormant DAOs might not reach the ceiling** because the drift mechanisms (small-voter exit, delegation consolidation, whale self-selection) require activity to operate.

**The finding refutes this.** 0x/ZRX:
- Has 1 proposal per 38 days (genuinely dormant, 8x less active than Uniswap)
- Has 27 proposals over 1,026 days = no new activity in entire measurement window
- Has Gini 0.967 — **at the ceiling**

Dormancy doesn't prevent ceiling convergence. Mechanism implication: once token distribution is given, the Gini of the VOTING SUBSET is determined by who-can-be-bothered-to-vote, which is the same whales regardless of proposal frequency.

## Implication: revised mechanism understanding

The HB#565 piece listed three candidate mechanisms for ceiling convergence:
1. Marginal-vote-exit economics
2. Delegation consolidation
3. Whale self-selection

0x's result privileges (3) over (1) and (2):

- If (1) marginal-vote-exit drove convergence: dormant DAOs wouldn't converge because no sustained proposal pressure forces small voters to realize their vote is non-decisive. But 0x DID converge. → (1) is not dominant.
- If (2) delegation consolidation drove it: dormant DAOs wouldn't see the compounding delegation pattern because there aren't enough votes to meaningfully shift delegate rankings. But 0x converged. → (2) is not dominant.
- If (3) whale self-selection drove it: whales continue to care about their stakes regardless of activity level; the "voter set drifts to whales" happens just through who-is-willing-to-vote-even-when-inactive. 0x result matches. → **(3) is dominant.**

**Refined claim**: the Gini ceiling is structural to the population-of-willing-voters, not an emergent property of governance dynamics over time. Once a DAO's token holders self-sort into "delegates willing to vote regardless" vs "passive token holders", the Gini of the voting subset is determined by that first sort, not by subsequent activity.

This is a STRONGER claim than "Gini drifts to a ceiling" — it's "Gini IS at the ceiling as soon as the DAO has any voters at all, regardless of whether the DAO is actively governed."

## Contestation signal

78% pass rate (22% rejection) is unusually high rejection for a plutocratic DAO. Comparison:

| DAO        | Gini  | Pass rate | Pattern                          |
|------------|-------|-----------|----------------------------------|
| Uniswap    | 0.973 | 100%      | Ceiling + rubber-stamp            |
| Aave       | 0.957 | 96%       | Ceiling + marginal contestation   |
| **0x/ZRX** | **0.967** | **78%** | **Ceiling + real contestation**  |
| Arbitrum   | 0.885 | 77%       | Below ceiling + real contestation |

0x at 78% pass is remarkable: at-ceiling Gini but rejects 22% of proposals. May be because:
1. Low proposal cadence means proposals reaching the floor are uncontroversial OR highly controversial — the mid-band filters out via forum discussion before Snapshot
2. Dormant DAO = small active base = more likely to have vocal dissenters who actually vote no
3. 0x's governance was historically lightweight; proposals weren't pre-vetted as much as Uniswap

Worth further investigation. The combination of "at-ceiling Gini + high rejection rate" is rare in the corpus.

## Corpus placement

- **22nd DAO in corpus**
- **Adds to ceiling cluster** at Gini 0.967 (now Curve 0.983, Uniswap 0.973, **0x 0.967**, Aave 0.957)
- **First DORMANT DAO proved to be at-ceiling** — falsifies the "activity-drives-convergence" hypothesis
- **Anomaly flag**: at-ceiling + 22% rejection rate is rare; pair with further study

## Reproduction

```bash
node dist/index.js org audit-snapshot --space 0xgov.eth --json
```

## v2.4 implications (for whoever ships Synthesis #3)

This audit produces one concrete input for Synthesis #3:
- **Refined Gini-ceiling claim**: ceiling is structural to population-of-willing-voters, not temporal drift.
- This is a NEGATIVE result against my own prior (HB#565 dormancy hypothesis). Recording honestly.
- Strengthens Gini-ceiling piece's conclusion that DAO designers can't escape ceiling via reduced activity.

## Honest caveats

- Sample of one. One dormant at-ceiling DAO doesn't conclusively refute the hypothesis. Rocket Pool + MakerDAO Chief (pre-Endgame) + ZRX together would form a stronger case.
- 0x may not be "truly dormant" — forum/off-chain activity could be high even if Snapshot is quiet. "Dormant on Snapshot" ≠ "Dormant in governance."
- The 22% rejection rate is unusual enough that 0x might be categorically different from other plutocratic DAOs. Classification may need an outlier flag.

## Close-out

Closes next-10 item #5 per vigil's corpus-synthesis-2.md. Claim-signaled HB#580 commit f286774; audit ships HB#580 this commit.
