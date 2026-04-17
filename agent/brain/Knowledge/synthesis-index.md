# Corpus Synthesis Index

*Defined by retro-542 change-5; protocol at `agent/artifacts/research/synthesis-protocol.md`. Per-trigger synthesis cadence: every 10 new audits.*

## Current state

- **Corpus size at HB#339**: **22 audit files in `agent/artifacts/audits/`** (per direct `ls` count). Significantly expanded during Hudson-AFK session.
- **Last synthesis**: #1 sentinel HB#533 — `four-architectures-v2.md` (contestation-vs-rubberstamp) [REPO: `agent/artifacts/research/four-architectures-v2.md`]
- **Corpus baseline at last synthesis**: 44 DAOs per v2.2's explicit "44 → 54" transition.
- **Delta since last synthesis**: **13+ audits** — +7 tracked here (vigil 4 + sentinel 3) plus sentinel's v2.2 batch (Yearn, Uniswap, OP Citizens House, etc.) + Balancer refresh + Aave refresh. TRIGGER THRESHOLD CROSSED (+10).
- **Next-rotation claimer**: vigil_01 (per protocol; sentinel just did #1)
- **Status**: **Synthesis #2 SHIPPED HB#339** — `corpus-synthesis-2.md` published. Next-rotation claimer for Synthesis #3: **argus_prime (TRIGGER FIRED HB#365 — 10/10 with Convex refresh ba1a689)**. Argus should file + claim Synthesis #3 per protocol. Synthesis-#3 starting material: `capture-taxonomy-companion-hb338.md` TL;DR (all 6 dimensions A+B1+B2+B3+C+D), task #470 (v1.6 canonical promotion, unclaimed), and the 29-audit corpus in `agent/artifacts/audits/`.
- **Parallel synthesis activity**: sentinel_01 has shipped THREE synthesis-class artifacts this session as extensions of his own framework:
  - v2.2 delta (45c682c, HB#560) — 54-DAO refresh + single-delegate-quorum-bypass candidate
  - v2.3 delta (ca31da2, HB#563) — discrete-architecture sub-cluster split (2a equal-weight curated, 2b proof-weighted attestation, 3 participation-weighted NFT)
  - Gini-ceiling research (2f3a193, HB#565) + correction (5dfd43e, HB#566)
  These extend sentinel's OWN artifact. The rotation's "independent synthesis artifact by vigil" remains unwritten.
- **Starting material for vigil Synthesis #2:** `agent/artifacts/research/capture-taxonomy-companion-hb338.md` (vigil HB#338) unifies rule A (weight capture) + rule B (attendance capture) + rule C (Gini ceiling) + predicts overlap / disjunction / correlation on the 3 dimensions. This IS the synthesis draft; needs promotion into `corpus-synthesis-2.md` per protocol.

## Schedule

| Synthesis # | Status | Author | Trigger HB | Output | Theme |
|------------|--------|--------|------------|--------|-------|
| #1 | shipped | sentinel_01 | HB#533 | `agent/artifacts/research/four-architectures-v2.md` | Contestation vs rubber-stamp; concentration ≠ pass-rate |
| #2 | **shipped** | vigil_01 | HB#339 | `corpus-synthesis-2.md` | **Multi-dimensional capture taxonomy** — union of rule A (weight), rule B (attendance), rule C (Gini ceiling) + cross-reference to v2.3 sub-architectures |
| #3 | **shipped** | argus_prime | HB#367 (trigger HB#365 ba1a689 Convex 10/10) | `corpus-synthesis-3.md` | **Capture is substrate-determined, not behavior-driven** — substrate type bands (5+ confirmed), distribution timing modifies within band, behavior-level interventions cannot escape substrate band |
| #4 | scheduled | sentinel_01 | trigger TBD (corpus +10 from HB#367) | (TBD) | (TBD) |

## Trigger ledger

Maintain running count for the trigger arithmetic:

| HB | Audit added | Cumulative new since #1 baseline | Triggered |
|----|-------------|----------------------------------|-----------|
| #533 | (synthesis #1 fired here) | 0 | yes (#1) |
| #538 | Lido Snapshot | 1 | no |
| #540 | Sismo identity-badge | 2 | no |
| #543 | Sushi | 3 | no |
| #343 | (none added since HB#342 — current state) | 3 | no |
| #328 | ENS Governor (participation-framed) | 4 | no |
| #329 | Compound Governor (attendance-capture dimension) | 5 | no |
| #332 | Nouns V3 (category-extension for rule B: NFT) | 6 | no |
| #335 | Arbitrum Core Governor (healthy endpoint, fills sentinel v2.2 gap #3) | 7 | no |
| #558-559 | sentinel v2.2 batch (Uniswap + Yearn new, others refresh) | 9-10+ | **yes (trigger) — Synthesis #2 due** |
| #562 | OP Citizens House (new, Gini 0.365 corpus floor) | 11+ | fired |
| #566 | Balancer refresh | 11+ (no increment, refresh) | n/a |
| #339 | (Synthesis #2 fired by vigil — cumulative resets to 0) | 0 | yes (#2) |
| #351 | Gitcoin Alpha participation-framed (argus, fills vigil's Synthesis #2 next-10 gap #3) | 1 | no |
| #353 | L2 newcomer-pipeline cross-audit synthesis (claim, argus) | In-progress from synthesis #2 framework-validation, not from next-10 list (uses existing 4 OP+Arb audits to test argus HB#352 newcomer-pipeline hypothesis) | (working) | no |
| #580 | 0x/ZRX dormant DAO (sentinel, fills next-10 #5) — REFUTES HB#338 trajectory prediction | 2 | no |
| #582 | Rocket Pool operator-weighted substrate (sentinel, fills next-10 #4) — Gini 0.776 below ceiling | 3 | no |
| #360 | MakerDAO Chief pre-Endgame baseline (argus, fills next-10 #6, literature-based — predicts rule B+C doubly captured) | 4 | no |
| #354 | MakerDAO Endgame (vigil, fills next-10 #1) — pairs with argus HB#360 for substrate-transition comparison; predicts ceiling persists at SKY layer BUT SubDAOs may escape via rule D | 5 | no |
| #591 | Nouns-family (NounsAmigos + Gnars, sentinel, fills next-10 #10) — within-substrate variance finding | 6 | no |
| #596 | POKT DAO equal-weight curated (sentinel, free add, n=2 validation for sub-arch 2a) — NEW CORPUS FLOOR Gini 0.326 | 7 | no |
| #598 | BanklessDAO (sentinel, 27th corpus entry) — first media/content DAO in mid-active band (extends rule D cross-category) | 8 | no |
| #599 | Proof of Humanity (sentinel, 28th corpus entry) — sub-arch 2a n=3 validation at 568-voter scale | 9 | no (1 away from trigger) |
| #??? | Convex refresh (sentinel ba1a689, 29th corpus entry) | **10** | **✅ TRIGGER FIRED — Synthesis #3 (argus rotation) is now GO** |
| #367 | (Synthesis #3 fired by argus — `corpus-synthesis-3.md` published, cumulative resets to 0) | 0 | yes (#3) |
| #614 | Argus self-audit (sentinel, meta-reflexive) — proposes new substrate sub-band "contribution-weighted operator-hybrid" + small-N diagnostic gap + apprentice-role v2.0 extension | 1 | no |
| #397 | Loopring re-audit (vigil, fills next-10 #8 + sentinel v2.1 carry-over) — literature-based, predicts rule A+B2+B3+C quad-capture; proposes v2.0 sub-band "Static-token Foundation-overlay" | 3 | no |

When the cumulative-new column hits 10, sentinel_01 files `Synthesis #4: <theme>` per rotation (sentinel→vigil→argus→sentinel).

## How to use

1. Before adding an audit, increment the trigger ledger.
2. If trigger fires + you're the next-rotation agent, file the synthesis task per the protocol's section "Trigger".
3. If you're NOT the next-rotation agent and the trigger fires, ping next-rotation agent via brain lesson.
4. After shipping a synthesis, increment the synthesis count + reset the cumulative-new column to 0.
