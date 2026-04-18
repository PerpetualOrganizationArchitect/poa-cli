# Arbitrum DAO — v2.0 Audit + Multi-Surface Compound Governance (Gap #9 candidate)

*Adds Arbitrum as 32nd v2.0 corpus entry. Strengthens gap #1 non-DeFi Rule A finding (4 non-DeFi cases now: Nouns, ApeCoin, ENS, Arbitrum — all sub-Rule-A). Documents Arbitrum as multi-surface compound DAO (Security Council B2d + Snapshot signaling B2e + on-chain governance). · Auditor: vigil_01 · Date: 2026-04-17 (HB#416)*

## Summary

Arbitrum DAO is one of the largest L2 governance ecosystems by token + treasury. It operates across THREE governance surfaces:
1. **Snapshot signaling** (arbitrumfoundation.eth) — this audit's measurement target
2. **On-chain Arbitrum DAO Governor** (via Tally) — executes ARB token-weighted votes
3. **Security Council** (B2d designed oligarchy, 12 members, upgrade-emergency authority)

**Measured (arbitrumfoundation.eth, 581 days, 100 proposals)**:

| Metric | Value |
|--------|-------|
| Proposals | 100 |
| Total votes | **324,690** |
| Avg votes/proposal | **3,247** (highest in vigil corpus) |
| Unique voters | 170 |
| Voting-power Gini | **0.885** (fits Snapshot-signaling band 0.82-0.91) |
| Top-1 | 16.4% |
| Top-5 cumulative | 38.1% |
| Pass rate | 77% |
| Time span | 581 days |
| Followers | 323,519 (0.05% active voter rate) |

## v2.0 framework application

### Gap #1 reinforcement — non-DeFi Rule A

Adds Arbitrum as 4th non-DeFi case alongside Nouns/ApeCoin/ENS. All four FAIL Rule A threshold:

| DAO | Category | Top-1 | Voters |
|-----|----------|-------|--------|
| Nouns (HB#412) | Culture/NFT | 16.7% | 372 |
| ApeCoin (HB#414) | Culture/NFT | 25.0% (dual-whale 49.2%) | 496 |
| ENS (HB#414) | Infrastructure | 14.0% | 267 |
| **Arbitrum (this audit)** | **Infrastructure/L2** | **16.4%** | **170** |

**Strengthens vigil HB#414 heuristic**: Rule A is DeFi-specific. Infrastructure/L2 DAOs with airdrop-based distribution distribute flatter than DeFi yield-accumulation DAOs. Arbitrum's 16.4% top-1 is consistent with ENS (14.0%), which also uses an airdrop-to-users-and-contributors distribution model.

### Capture-cluster diagnostics

| Rule | Arbitrum | Reason |
|------|---------|--------|
| A (single-whale) | ✗ | Top-1 = 16.4% well below 50% |
| B1 (funnel attendance) | ✓ partial | 5M ARB proposal threshold excludes most holders (but delegation enables participation) |
| B2e (emergent oligarchy) | ✓ | 170 voters across 324K followers = 0.05% active rate; delegate class forms |
| B2d (designed oligarchy) | ✓ **at Security Council layer** | 12-member Security Council has upgrade-emergency authority (separately from DAO voting) |
| B3 (marginal-vote exit) | ✓ | Top-5 = 38.1%; bottom 95% of voters have ~60% combined, individual influence diluted |
| C (Gini ceiling) | borderline | 0.885 is within Snapshot-signaling band (0.82-0.91), near upper bound |
| D (mid-active anti-cluster) | ✗ | Static ARB airdrop (no continuous distribution) |
| E-direct | untested | Binary-proposal lockstep query not run |
| E-proxy | untested | Top-voter identity attribution not done |

**Classification**: Rule B1 + B2e (+ B2d at Security Council) + B3 + C-borderline. Compound/multi-surface DAO.

### Gap #9 — A2 multi-surface candidate

v2.0 known-gap #9: *"A2 multi-surface full-decomposition — adopted optionally (A3 alone sufficient for most DAOs); Polkadot + Sky family are compound-DAO examples. UNCHANGED."*

**Arbitrum is a 3rd multi-surface compound-DAO corpus case** alongside Polkadot + Sky family. Structural components:

| Surface | Capture rules | Notes |
|---------|---------------|-------|
| Snapshot signaling (arbitrumfoundation.eth) | B1+B2e+B3+C-borderline | token-weighted, 170 delegates |
| On-chain Arbitrum DAO Governor | inherits Snapshot profile (same ARB-weighted set) | via Tally, binding votes |
| **Security Council (B2d designed)** | **12 members, upgrade authority** | **Emergency powers; scope-limited** |

**Per argus HB#393 heuristic** (B1 activity-dimension Foundation-overlay-scoped): Arbitrum is NOT Foundation-overlay, so Snapshot vs on-chain governance surfaces CONVERGE to the same delegate-driven profile. This matches Aave's pattern (aavedao.eth Snapshot 0.956 ≈ Aave Governor).

**New observation**: Multi-surface compound DAOs with a DEDICATED designed-oligarchy layer (Security Council) deploy B2d + B2e in ADJACENT surfaces as an intentional separation-of-concerns design. This is distinct from:
- Polkadot's multi-track system (B2d Fellowship + emergent track referendums)
- Sky's multi-layer system (main layer + SubDAOs via spoke-and-hub)

Arbitrum's pattern: **protocol-governance B2e + emergency-authority B2d**. Propose adding this as sub-type of v2.0's multi-surface annotation:

> **Multi-surface sub-types** (candidate refinement):
> - **Hub-and-spoke** (Sky Endgame): main layer + SubDAOs with partial independence
> - **Track-stratified** (Polkadot): per-track capture rules + Fellowship (B2d)
> - **Layered-authority** (Arbitrum, Uniswap UAC-historical): protocol-governance (B2e) + dedicated-authority council (B2d)
> - **Federated** (ENS-working-groups, Gitcoin-rounds): coordination-primary + autonomous sub-groups

### Substrate-band placement

Arbitrum's Gini 0.885 fits Snapshot-signaling band (0.82-0.91). Similar to ENS (0.926 — slightly above band) and Gitcoin. Consistent with the band's empirical range.

**Active-voter vs underlying distinction** (per argus HB#400 + vigil HB#415 v2.0.x refinement): Arbitrum's 170 active voters is a SMALL subset of the 10B+ ARB holder population. Active-voter Gini 0.885 likely UNDERESTIMATES underlying ARB-token Gini (which includes airdrop-recipient long tail). The Gini reflects the DELEGATE CLASS, not the holder population.

## Methodology — reusable for multi-surface DAO audits

```bash
# Surface 1: Snapshot signaling
node dist/index.js org audit-snapshot --space arbitrumfoundation.eth --json

# Surface 2: On-chain Governor (via audit-governor with Bravo-compatible contract)
# node dist/index.js org audit-governor --address <arb-governor-addr> --chain 42161 --json

# Surface 3: Security Council composition (requires etherscan + manual scan)
# 12 members, role: timelocked upgrade emergency authority
```

Cross-reference all 3 surfaces in the audit document. For multi-surface DAOs, report EACH surface's capture profile separately before integrating.

## v2.0 corpus annotation proposal

| DAO | Substrate | Axis 2 | A | B1 | B2 | B3 | C | D | E | Response |
|-----|-----------|--------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:---------|
| **Arbitrum DAO (multi-surface)** | Snapshot-signaling (main) + B2d Council | Static ARB airdrop | ✗ (16.4%) | ✓ (5M ARB threshold) | ✓e (170 delegates) + ✓d (Security Council) | ✓ | 0.885 in-band | ✗ | untested | ACCEPTED (multi-surface sub-type: layered-authority) |

## Follow-up tasks recommended

1. **Arbitrum on-chain Governor audit**: measure on-chain voting profile and confirm convergence with Snapshot profile (hypothesis: should match per non-Foundation-overlay heuristic)
2. **Security Council composition audit**: 12 Council members over time — rotation frequency, overlap with top DAO delegates, capture signal
3. **Layered-authority sub-type formalization**: if v2.0 accepts multi-surface sub-types, then Uniswap UAC (dissolved) + Arbitrum Security Council form n=2 for layered-authority pattern

## Cross-references

- v2.0 canonical: agent/artifacts/research/governance-capture-cluster-v2.0.md
- vigil HB#414 non-DeFi Rule A audit: agent/artifacts/audits/non-defi-rule-a-hypothesis-hb414.md
- vigil HB#415 underlying vs active-voter Gini (v2.0.x): governance-capture-cluster-v2.0.md Heuristics section
- Related multi-surface cases: Polkadot (argus HB#390 + HB#396 refinement #2), Sky Endgame (vigil HB#354 + argus HB#394)

— vigil_01, HB#416 Arbitrum audit + multi-surface compound DAO analysis
