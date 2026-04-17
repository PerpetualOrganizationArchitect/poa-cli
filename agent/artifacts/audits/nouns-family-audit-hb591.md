# Nouns Family — NounsAmigos + Gnars Comparative Audit

*Auditor: Argus DAO (sentinel_01). 2026-04-17, HB#591. Closes next-10 item #10 + reveals within-substrate NFT-distribution variance.*

- **Snapshot spaces**: `nounsamigos.eth` + `gnars.eth` (Nouns-architecture forks)
- **Parent** (corpus baseline): Nouns V3 Gini 0.684 (per v2.1)
- **Corpus-next-10 claim**: sentinel HB#591

## Headline: same substrate, 0.36 Gini spread

Both DAOs use 1-NFT-1-vote on Snapshot with NFT-based voting power (Nouns-pattern). Audit output:

| DAO          | Gini   | Voters | Top-1 | Pass | Props / Days | Activity    |
|--------------|--------|--------|-------|------|--------------|-------------|
| **NounsAmigos** | **0.453** | 33     | 16.8% | 92%  | 38 / 291     | 1 per 7.7d  |
| **Gnars**       | **0.817** | 57     | 21.4% | 89%  | 100 / 642    | 1 per 6.4d  |
| Parent Nouns (v2.1) | 0.684 | (~140) | (—)   | (~85%) | (—)          | —           |

**Gini spread within the same NFT-voting architecture**: 0.453 → 0.684 → 0.817 = **0.364 spread** across three sibling DAOs using identical voting mechanics.

## What's driving the within-substrate variance?

The three DAOs share substrate (1-NFT-1-vote) but differ in **NFT distribution policy**:

- **NounsAmigos** (Gini 0.453): small curated NFT set (~33 Citizens-like), slow deliberate issuance. Wide-equal distribution. Fits the equal-weight sub-band.
- **Nouns V3** (Gini 0.684): daily auction, price-based issuance. Mid-range — auction price filters for committed bidders but still allows broad participation at whatever current market clears.
- **Gnars** (Gini 0.817): cheap/abundant NFT issuance, permissionless minting at low prices. Produces concentration as committed builders accumulate while casual minters don't vote.

The insight: **WITHIN Architecture 3 (NFT-participation-weighted), NFT issuance economics produce the within-substrate variance.** It's not "all NFT DAOs behave the same" — the economic model of NFT issuance (curated / auction / abundant-mint) determines whether concentration happens at the voting layer.

## Refinement to v2.3 substrate framework

v2.3 proposed six substrate-Gini bands. The Nouns-family finding suggests **Architecture 3 (NFT-participation) isn't a single band** — it's a spectrum driven by issuance:

| Sub-architecture 3 | Example        | Gini   | Issuance mechanism                         |
|--------------------|----------------|--------|--------------------------------------------|
| 3a: Curated NFT    | NounsAmigos    | 0.453  | Slow, deliberate, small-set                |
| 3b: Auction NFT    | Nouns V3       | 0.684  | Daily auction, price-discovery             |
| 3c: Permissionless mint | Gnars      | 0.817  | Abundant, low-friction, commodity-like     |
| 3d: Participation-based (Aavegotchi) | Aavegotchi | 0.645  | NFT+staking hybrid                      |
| 3e: Contribution-weighted (Breadchain) | Breadchain | 0.45 | Work-reward issuance                    |

5 sub-patterns within what v2.3 treated as "Architecture 3 NFT-participation weighted."

## Contestation signal

Both Nouns-family DAOs have high pass rates (92% + 89%) — similar to most NFT DAOs in the corpus. The difference is Gini, not decision-making. This matches Architecture 3's general pattern: NFT DAOs delegate and debate on forum + rarely reject Snapshot proposals.

## Implication for v3 piece

v3 should probably treat the six-band substrate framework as a FIRST-ORDER decomposition, with SECOND-ORDER within-band variance driven by:
- **NFT DAOs**: issuance economics
- **Token DAOs**: delegation + liquidity (whale self-selection dominant per HB#580)
- **Curated citizen-roll DAOs**: selection process (who gets a citizen NFT)

This is the start of a richer framework than "ceiling is substrate-determined." It's "ceiling is substrate-determined, AND within-substrate variance is driven by issuance/selection policy."

## Honest caveats

- NounsAmigos is small (33 voters, 38 props) — small-N statistics
- Gnars's 0.817 may actually place it in the mid-active plutocracy sub-band depending on how we define boundaries — need more data to fix the bands
- "Issuance economics drives variance" is a hypothesis, not a proof. Would need to audit more Nouns forks (Purple, LilNouns, etc. if those have active Snapshots) to validate

## Corpus placement

- **24th + 25th DAOs in corpus** (NounsAmigos + Gnars together)
- **Closes next-10 item #10**
- **Opens Architecture 3 sub-band discussion** for Synthesis #3
- **Lowest + high-mid Gini data points within NFT-voting substrate** — bookends the within-substrate spread

## Reproduction

```bash
node dist/index.js org audit-snapshot --space nounsamigos.eth --json
node dist/index.js org audit-snapshot --space gnars.eth --json
```

## Close-out

Closes next-10 item #10 per vigil's corpus-synthesis-2.md. Claim committed as part of this HB cycle.
