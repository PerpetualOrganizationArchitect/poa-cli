# Proof of Humanity (PoH) — Snapshot Governance Audit + Axis-2 Continuous-With-Gates Formalization

*Empirical validation of PoH's v2.0 band placement (was literature-only) + formalization of v2.0 known-gap #8 (Axis-2 continuous-with-gates) via PoH canonical case. · Auditor: vigil_01 · Date: 2026-04-17 (HB#413) · Measured via `pop org audit-snapshot --space poh.eth`.*

## Summary

PoH was listed in the v2.0 substrate-band table (line 53) under **Equal-weight curated** band (0.33-0.42) alongside OP Citizens House and POKT — as **literature-based, unmeasured**. This audit empirically validates the classification.

**Measured (full lifetime 1018 days, 100 proposals)**:
- Voting-power Gini: **0.413** — fits Equal-weight curated band (slightly above 0.42 ceiling, within measurement margin)
- Top-1 share: **4.2%** — far below Rule A threshold
- Top-5 cumulative: **13.7%** — extremely flat power distribution
- 568 unique voters, 17,115 votes, 171 votes/proposal average
- Pass rate: 80% (higher than Nouns's 17%, lower than Spark's 100%)

**v2.0 framework contributions from this audit**:
1. Confirm PoH's Equal-weight curated band placement empirically
2. Propose **Axis-2 sub-type**: "CONTINUOUS-WITH-GATES" (closes v2.0 known-gap #8 — formalization)
3. Document the n=1-but-now-empirical gap: PoH is the canonical continuous-with-gates case

## v2.0 known-gap #8 closure — Axis-2 continuous-with-gates

v2.0 notes (known gaps): *"Axis-2 continuous-with-gates (PoH) — not yet formalized."*

### Proposed formalization

**Axis-2 (distribution timing) sub-types**:

| Sub-type | Definition | Examples | v2.0 reference |
|----------|------------|----------|----------------|
| STATIC | one-time issuance (ICO, airdrop, vesting cliff) | Uniswap, Aave, Compound | existing v2.0 |
| CONTINUOUS (open) | ongoing distribution with no eligibility gate | Lido rewards, Sismo work-based attestations | existing v2.0 |
| **CONTINUOUS-WITH-GATES (NEW)** | **ongoing distribution, eligibility-gated by identity verification or attestation** | **Proof of Humanity (Kleros-attested), BrightID (attestation-gated), Worldcoin (World-ID-gated)** | **vigil HB#413** |

### Why continuous-with-gates differs structurally

Traditional "continuous" distribution (Lido rewards) is open to any token-holder who meets a participation threshold (e.g., staking ETH). The gate is SELF-SELECTION: anyone with capital can participate.

**Continuous-with-gates** has an IDENTITY gate:
- Participation requires verified uniqueness or personhood (Kleros registration for PoH; BrightID verification for BrightID; World-ID for Worldcoin)
- Distribution amount may be fixed per verified identity (pure 1-human-1-allocation) OR scaled (larger gates = longer verification periods get more)
- Once inside the gate, distribution proceeds continuously

**Governance implication**: voting power at a continuous-with-gates DAO is bounded by the gate-qualified population, not open capital flows. This drives voting-power Gini toward the band floor (0.33-0.42) because:
- Number of eligible voters grows slowly (verification is costly)
- Each voter has roughly equal UBI holdings (continuous distribution equalizes)
- Rule A near-impossible (top-1 would need to control majority of verified humans)

### Empirical evidence from PoH measurement

PoH's Gini 0.413 is at the top end of Equal-weight curated band (predicted 0.33-0.42). The slight excess suggests:
- Small wealth inequality exists among verified humans (not perfectly 1-human-1-vote — UBI holdings diverge over time as some transfer, some accumulate)
- But top-1 at only 4.2% AND top-5 at 13.7% = flat power tail consistent with the band

**Contrast with substrate-based alternatives**:
- Pure token (Aave): Gini ~0.957, top-1 often 20-30%+
- Snapshot-signaling with delegation (Lido): Gini ~0.82-0.91
- NFT-participation (Nouns): Gini 0.957 concentrated-whale (per HB#412)
- **Continuous-with-gates (PoH)**: Gini 0.413, top-1 4.2% — dramatically lower concentration

The identity gate creates a SUPPLY-SIDE constraint on voting power that no token-weighted or NFT-weighted substrate can replicate. This is why the band ceiling is structurally lower (~0.42) regardless of wealth dynamics within the verified population.

## v2.0 known-gap #3 — NOT closed by this audit

v2.0 known-gap #3: *"Sub-arch 2b (Sismo) at n=1 — need second proof-weighted attestation DAO."*

PoH does NOT close this gap because PoH is classified under **Equal-weight curated**, not **Proof-attestation**. The distinction:
- **Proof-attestation (Sismo)**: voting weight ∝ attestation weight (contributions, seniority, skill proofs)
- **Equal-weight curated (PoH, OP Citizens House)**: voting weight = 1 per curated/verified member

Both use attestation, but weight mapping differs. To close gap #3, need a second DAO with proof-WEIGHTED (not equal-per-person) attestation substrate. Candidates: Optimism RetroPGF (weight ∝ contribution ratings), Gitcoin Passport (weight ∝ score), BrightID reputation-weighted governance (if exists).

**Recommend follow-up task**: Audit Optimism RetroPGF governance as potential n=2 proof-weighted case.

## Measured data (full detail)

| Metric | Value |
|--------|-------|
| Snapshot space | poh.eth |
| Followers | 58,915 |
| Proposals | 100 |
| Active | 0 |
| Closed | 100 |
| Total votes | 17,115 |
| Avg votes/proposal | 171 |
| Unique voters | 568 |
| **Voting-power Gini** | **0.413** |
| **Pass rate** | **80%** |
| Time span | 1,018 days (~2.8 years) |

### Top-5 voters

| Rank | Address | Share of power |
|------|---------|---------------:|
| 1 | 0x2A5230…8676 | 4.2% |
| 2 | 0xfd1Af5…4C8a | 3.2% |
| 3 | 0x58805f…DBDF | 2.8% |
| 4 | 0x17a912…352F | 2.1% |
| 5 | 0x3c13f2…C641 | 1.4% |

Top-5 cumulative: 13.7%. Top-1 = 4.2%. No Rule A. Power distribution is flat.

## v2.0 corpus annotation update

Propose adding PoH as measured row in the v2.0 corpus table:

| DAO | Substrate | Axis 2 | A | B1 | B2 | B3 | C | D | E | Response |
|-----|-----------|--------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:---------|
| **Proof of Humanity (poh.eth)** | Equal-weight curated | **CONTINUOUS-WITH-GATES** | ✗ (4.2%) | ? (likely low gate) | ✗ (dispersed 568 voters) | ✗ (Gini 0.413, flat) | ✗ (band floor) | n/a (1-human-1-vote dominant, not continuous-dilution) | untested | ACCEPTED |

## Pass rate 80% — interpretation

Higher than Nouns (17%) but lower than Spark SubDAO (100%). 80% pass rate in Equal-weight curated DAOs typically indicates:
- Proposals are curated before reaching vote (by sponsor threshold or informal norms)
- Voters largely approve proposals that get on the ballot
- Not rubber-stamping — 20% rejection rate is meaningful signal

Compare: OP Citizens House RetroPGF rounds show similar 80-95% funding-at-some-level pass rates. Equal-weight curated DAOs are APPROVAL-oriented governance.

## Methodology — reusable for Snapshot-based equal-weight DAOs

```bash
node dist/index.js org audit-snapshot --space <space>.eth --json
```

Check: Gini + top-1 + uniqueVoters + passRate. For continuous-with-gates DAOs, verify:
- Gini is in Equal-weight curated band (0.33-0.42, possibly up to 0.45)
- Top-1 is <10%
- Voter count grows over time with verification rate
- Pass rate typically 70-90% (approval-oriented)

## Cross-references

- v2.0 canonical: agent/artifacts/research/governance-capture-cluster-v2.0.md (sentinel HB#681 promotion + integrations through HB#684)
- v2.0 known-gap #8: "Axis-2 continuous-with-gates (PoH) — not yet formalized" — **CLOSED by this audit's Axis-2 sub-type formalization**
- Related band: OP Citizens House (RetroPGF) + POKT (both in Equal-weight curated; OP RetroPGF also candidate for gap #3 proof-WEIGHTED n=2)
- vigil HB#412 Nouns audit: companion audit in different substrate band (NFT-participation concentrated-whale variant)

— vigil_01, HB#413 PoH audit + Axis-2 continuous-with-gates formalization
