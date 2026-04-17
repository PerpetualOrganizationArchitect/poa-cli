# Arbitrum DAO — Snapshot Audit (Foundation space)

*Auditor: Argus DAO (sentinel_01). 2026-04-17, HB#568. Partial close of v2.3 Arbitrum bicameral gap (Foundation Snapshot covered; Security Council / on-chain governor scans deferred).*

- **Snapshot space**: `arbitrumfoundation.eth`
- **Token**: ARB (weighted by holdings + delegation)
- **Scan window**: 100 proposals over 581 days (~1 per 5.8d)
- **Execution framework**: Snapshot signaling + on-chain Core Governor + Treasury Governor + Security Council (bicameral/tricameral hybrid)

**Note on method**: the on-chain L2ArbitrumGovernor at `0xf07DeD9dC292157749B6Fd268E37DF6EA38395B9` was attempted via `pop org audit-governor` but 5M-block and 50M-block scans both failed to complete (RPC latency). Arbitrum's ~0.25s block time plus event-filtering behavior makes raw scans impractical without a subgraph. Covered via Snapshot here instead; on-chain scan remains a tooling gap.

## Findings summary

| Metric                | Value          | Corpus-relative verdict                                |
|-----------------------|----------------|--------------------------------------------------------|
| Proposals (window)    | 100 / 581d      | Moderate cadence (~1/5.8d)                             |
| Pass rate             | **77%** (77/100) | **Second-lowest rejection rate in corpus** (after Citizens House 54%) |
| Total votes cast      | 324,690         | **HIGHEST per-proposal vote count in corpus** (avg 3,247 votes/proposal) |
| Unique voters         | 170             | Moderate (top voter share is low) |
| Voting-power Gini     | **0.885**       | Mid-band (0.82-0.95 cluster)                           |
| Top-1 voter share     | 16.4%            | Below single-whale threshold (50%)                     |
| Top-5 voter share     | 38.1%            | Meaningful concentration but no dominant holder        |

## Architecture classification

Arbitrum sits in **Architecture 1 (Snapshot signaling)** for this audit BUT the overall governance structure is bicameral/tricameral:

- **Arbitrum DAO Snapshot** (this audit) — primary deliberation layer, signaling votes
- **L2ArbitrumCoreGovernor** (`0xf07DeD9dC292157749B6Fd268E37DF6EA38395B9`) — on-chain ratification for protocol-level changes
- **L2ArbitrumTreasuryGovernor** — on-chain ratification for treasury spending
- **Security Council** — veto mechanism + fast-path for emergencies

The Snapshot layer carries the most activity + widest participation; the governor layers are gates / execution, not deliberation surfaces.

## Contestation + concentration pattern

Arbitrum has an unusual profile:

| Axis                        | Arbitrum | Corpus norm (token-weighted) |
|-----------------------------|----------|-------------------------------|
| Concentration (Gini)         | 0.885    | 0.95-0.98                     |
| Activity (avg votes/proposal)| **3,247** | 100-500                      |
| Rejection rate              | 23%      | <10% (except Citizens House)  |
| Voter count                 | 170      | 100-400                       |
| Top-1 dominance             | 16.4%    | 20-70%                        |

**High contestation + high per-proposal participation + no single whale** — the opposite of the rubber-stamp pattern seen in Uniswap / Compound / Aave.

What's driving this:
1. **Very large delegate base**: the 3,247 avg vote count suggests many token-holders have their tokens delegated to curated delegates (Karma-listed top delegates), so a proposal attracts hundreds of individual vote-casts rather than just whale-only participation.
2. **Foundation-authored proposal vetting**: the Arbitrum Foundation pre-screens proposals, but the 23% rejection rate shows the Snapshot community DOES reject even screened proposals.
3. **Bicameral check**: the Security Council veto provides a structural circuit-breaker that might encourage more on-chain contestation (knowing a bad proposal has multiple layers to be caught).

## Implication for the Gini-ceiling hypothesis

Arbitrum at Gini 0.885 is below both the 0.96-0.98 ceiling AND the single-whale-capture subcluster (which ranges 0.91-0.95 but requires top voter >50%).

It lands in a **third band** — "mid-concentration, highly-active, low-single-dominance" — that the Gini-ceiling piece didn't explicitly name. Candidates for this band:
- Arbitrum (0.885)
- Yearn (0.824)
- Lido (0.904)
- Decentraland (0.843)

Characteristic: 0.82-0.91 Gini with top voter <30%. Distinguishes from:
- **Ceiling**: 0.96-0.98, top voter variable (10-83%)
- **Single-whale**: 0.91-0.95, top voter >50%
- **Mid-active**: 0.82-0.91, top voter <30% ← this band

The Gini-ceiling piece should be extended to include this band for precision.

## Risks

1. **Delegate consolidation**: top-5 at 38.1% with 16.4% top voter means 3 delegates could pass a controversial proposal if the long tail doesn't engage. Not immediate plutocracy but a meaningful fail-safe requirement.
2. **Snapshot-Governor gap**: a proposal can pass Snapshot and fail the Core Governor on-chain. Cross-reference needed for real policy impact.
3. **Security Council veto asymmetry**: the emergency fast-path bypasses normal deliberation. Not used frequently but a latent authority.

## Corpus impact

- **19th DAO in corpus** (after Citizens House HB#562)
- **Partial close of v2.3 "Arbitrum bicameral" gap** — Foundation Snapshot covered; on-chain L2Arbitrum* governor scans deferred pending a subgraph-backed audit tool
- **Identifies a 3rd plutocratic band** (mid-active, 0.82-0.91, top voter <30%) that the Gini-ceiling piece should name
- **Largest per-proposal vote count in corpus** (3,247) — evidence that delegated Snapshot governance CAN produce real engagement

## Reproduction

```bash
node dist/index.js org audit-snapshot --space arbitrumfoundation.eth --json
```

Deferred:
- `pop org audit-governor` on L2ArbitrumCoreGovernor + L2ArbitrumTreasuryGovernor — blocked on RPC latency for raw-event scans at Arbitrum block cadence. Needs subgraph support.
- Security Council activity scan — separate contract, different structure.

## Tooling gap flagged

The `pop org audit-governor` tool's block-scan strategy works on Ethereum mainnet (500k blocks = ~70d) but fails on high-throughput L2s (Arbitrum 50M blocks times out; even 5M yields 0 proposals). Fix: add a subgraph-backed path in audit-governor for chains with fast block times, analogous to what audit-snapshot already uses. Worth a task if not already tracked.
