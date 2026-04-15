/**
 * AUDIT_DB — canonical store of governance audit data accumulated across
 * sentinel_01's audit-snapshot runs. 51 entries as of HB#328.
 *
 * This module exists because portfolio.ts and compare-time-window.ts both
 * need read access to this data, and pulling it from a shared lib avoids
 * either (a) inline duplication or (b) heavy-import side effects from
 * importing portfolio.ts (which has its own spinner/output coupling).
 *
 * Schema:
 *   grade     — A/B/C/D ranking on a composite governance score
 *   score     — 0-100 health score using the rubric established in v1
 *               of the Four Architectures research piece
 *   gini      — voting-power Gini coefficient (0 = perfect equality,
 *               1 = perfect concentration). Authoritative single number
 *               that drives most architectural classification.
 *   category  — semantic category (DeFi, NFT Governance, Bridge, etc).
 *               Used for the temporal-stability category-split finding
 *               from HB#317 (DeFi divisible drifts worse, non-DeFi
 *               divisible mixed/stable).
 *   voters    — unique voters across the last 100 proposals on Snapshot,
 *               or equivalent for Governor/Safe DAOs. Optional because
 *               some entries pre-date voter-count tracking.
 *   platform  — Snapshot / Governor / Safe / POP / hybrid. NOTE: the
 *               discrete-vs-divisible classifier is about SUBSTRATE not
 *               PLATFORM (per HB#300 Loopring reclassification — Loopring
 *               is on Snapshot but classified discrete because its LRC
 *               distribution reflects participation in the zkRollup
 *               ecosystem rather than open-market accumulation).
 *
 * Future schema expansion: add `space?: string` per row so the
 * compare-time-window SPACE_TO_NAME mapping can be derived from the
 * AUDIT_DB rather than maintained as a separate manual table. Out of
 * scope for the HB#328 minimal extraction.
 */

export interface AuditEntry {
  grade: string;
  score: number;
  gini: number;
  category: string;
  voters?: number;
  platform: string;
}

export type ArchitectureClass = 'discrete' | 'divisible';

export const AUDIT_DB: Record<string, AuditEntry> = {
  'Breadchain': { grade: 'B', score: 82, gini: 0.45, category: 'Cooperative', voters: 12, platform: 'POP' },
  'Giveth': { grade: 'C', score: 72, gini: 0.68, category: 'Public Goods', voters: 45, platform: 'POP' },
  '1Hive': { grade: 'B', score: 80, gini: 0.52, category: 'Community', voters: 30, platform: 'POP' },
  'SafeDAO': { grade: 'B', score: 78, gini: 0.924, category: 'Infrastructure', voters: 213, platform: 'Snapshot' },
  'Balancer': { grade: 'D', score: 55, gini: 0.911, category: 'DeFi', voters: 24, platform: 'Snapshot' },
  'Aave': { grade: 'D', score: 58, gini: 0.957, category: 'DeFi', voters: 193, platform: 'Snapshot' },
  'Compound': { grade: 'C', score: 68, gini: 0.911, category: 'DeFi', voters: 95, platform: 'Governor' },
  'Curve': { grade: 'D', score: 50, gini: 0.983, category: 'DeFi', voters: 188, platform: 'Snapshot' },
  'Uniswap': { grade: 'C', score: 68, gini: 0.92, category: 'DeFi', voters: 200, platform: 'Governor' },
  'Maker': { grade: 'C', score: 72, gini: 0.87, category: 'DeFi', voters: 180, platform: 'Governor' },
  'Frax': { grade: 'D', score: 45, gini: 0.970, category: 'DeFi', voters: 42, platform: 'Snapshot' },
  'Olympus': { grade: 'B', score: 76, gini: 0.842, category: 'DeFi', voters: 32, platform: 'Snapshot' },
  'Convex': { grade: 'D', score: 58, gini: 0.951, category: 'DeFi', voters: 128, platform: 'Snapshot' },
  '1inch': { grade: 'D', score: 58, gini: 0.93, category: 'DeFi', voters: 63, platform: 'Snapshot' },
  'Lido': { grade: 'C', score: 71, gini: 0.904, category: 'DeFi', voters: 102, platform: 'Snapshot' },
  'Sushi': { grade: 'D', score: 50, gini: 0.975, category: 'DeFi', voters: 121, platform: 'Snapshot' },
  'ENS': { grade: 'D', score: 52, gini: 0.976, category: 'Infrastructure', voters: 97, platform: 'Governor' },
  'Arbitrum': { grade: 'C', score: 68, gini: 0.885, category: 'L2', voters: 170, platform: 'Snapshot' },
  'Optimism': { grade: 'B', score: 76, gini: 0.82, category: 'L2', voters: 300, platform: 'Snapshot' },
  'Gitcoin': { grade: 'D', score: 58, gini: 0.979, category: 'Public Goods', voters: 199, platform: 'Snapshot' },
  'ApeCoin': { grade: 'D', score: 55, gini: 0.95, category: 'Metaverse', voters: 80, platform: 'Snapshot' },
  'Decentraland': { grade: 'C', score: 70, gini: 0.843, category: 'Metaverse', voters: 59, platform: 'Snapshot' },
  'Bankless': { grade: 'C', score: 70, gini: 0.860, category: 'Community', voters: 344, platform: 'Snapshot' },
  'PleasrDAO': { grade: 'C', score: 65, gini: 0.89, category: 'Art', voters: 25, platform: 'Snapshot' },
  'PoolTogether': { grade: 'C', score: 68, gini: 0.91, category: 'DeFi', voters: 97, platform: 'Governor' },
  'GnosisDAO': { grade: 'D', score: 65, gini: 0.95, category: 'Infrastructure', voters: 189, platform: 'Snapshot+Safe' },
  'Rocket Pool': { grade: 'B', score: 78, gini: 0.776, category: 'DeFi', voters: 121, platform: 'Snapshot' },
  'Morpho': { grade: 'D', score: 55, gini: 0.858, category: 'DeFi', voters: 29, platform: 'Snapshot' },
  'Nouns': { grade: 'B', score: 75, gini: 0.684, category: 'NFT Governance', voters: 45, platform: 'Snapshot' },
  'Fingerprints': { grade: 'C', score: 62, gini: 0.866, category: 'NFT Governance', voters: 60, platform: 'Snapshot' },
  'KlimaDAO': { grade: 'D', score: 55, gini: 0.936, category: 'Climate/Regen', voters: 370, platform: 'Snapshot' },
  'FloorDAO': { grade: 'C', score: 68, gini: 0.787, category: 'NFT Governance', voters: 61, platform: 'Snapshot' },
  'StakeDAO': { grade: 'C', score: 60, gini: 0.822, category: 'DeFi', voters: 57, platform: 'Snapshot' },
  'Optimism Collective': { grade: 'C', score: 65, gini: 0.891, category: 'L2', voters: 177, platform: 'Snapshot' },
  'Sismo': { grade: 'B', score: 77, gini: 0.683, category: 'Identity/zk', voters: 472, platform: 'Snapshot' },
  'Gearbox': { grade: 'D', score: 55, gini: 0.863, category: 'DeFi', voters: 59, platform: 'Snapshot' },
  'Aavegotchi': { grade: 'B', score: 80, gini: 0.642, category: 'Gaming', voters: 164, platform: 'Snapshot' },
  'Kleros': { grade: 'C', score: 65, gini: 0.834, category: 'Arbitration', voters: 119, platform: 'Snapshot' },
  'Loopring': { grade: 'A', score: 85, gini: 0.665, category: 'L2/zkRollup', voters: 742, platform: 'Snapshot' },
  'Harvest Finance': { grade: 'D', score: 58, gini: 0.93, category: 'DeFi', voters: 422, platform: 'Snapshot' },
  'Yearn': { grade: 'C', score: 72, gini: 0.824, category: 'DeFi', voters: 425, platform: 'Snapshot' },
  'Hop': { grade: 'D', score: 48, gini: 0.971, category: 'Bridge', voters: 248, platform: 'Snapshot' },
  'Synthetix Council': { grade: 'C', score: 65, gini: 0.231, category: 'Delegated Council', voters: 8, platform: 'Snapshot' },
  'Radiant Capital': { grade: 'D', score: 52, gini: 0.967, category: 'DeFi', voters: 429, platform: 'Snapshot' },
  'BadgerDAO': { grade: 'D', score: 42, gini: 0.980, category: 'DeFi', voters: 78, platform: 'Snapshot' },
  'Venus': { grade: 'D', score: 48, gini: 0.854, category: 'DeFi', voters: 12, platform: 'Snapshot' },
  'dYdX': { grade: 'D', score: 35, gini: 0.000, category: 'DeFi', voters: 1, platform: 'Snapshot' },
  'Shutter': { grade: 'C', score: 72, gini: 0.758, category: 'Privacy', voters: 40, platform: 'Snapshot' },
  'GMX': { grade: 'C', score: 62, gini: 0.930, category: 'DeFi', voters: 511, platform: 'Snapshot' },
  'Stargate': { grade: 'D', score: 55, gini: 0.938, category: 'Bridge', voters: 262, platform: 'Snapshot' },
  'PancakeSwap': { grade: 'D', score: 38, gini: 0.987, category: 'DeFi', voters: 589, platform: 'Snapshot' },
  'Aragon': { grade: 'D', score: 52, gini: 0.909, category: 'Infrastructure', voters: 57, platform: 'Snapshot' },
  'Across': { grade: 'D', score: 55, gini: 0.933, category: 'Bridge', voters: 119, platform: 'Snapshot' },
  'Beethoven X': { grade: 'D', score: 55, gini: 0.917, category: 'DeFi', voters: 70, platform: 'Snapshot' },
  'Index Coop': { grade: 'C', score: 70, gini: 0.675, category: 'DeFi', voters: 22, platform: 'Snapshot' },
  'Euler': { grade: 'C', score: 68, gini: 0.896, category: 'DeFi', voters: 60, platform: 'Snapshot' },
  'Kwenta': { grade: 'D', score: 55, gini: 0.926, category: 'DeFi', voters: 91, platform: 'Snapshot' },
  'Alchemix': { grade: 'C', score: 68, gini: 0.871, category: 'DeFi', voters: 66, platform: 'Snapshot' },
  'Instadapp': { grade: 'C', score: 68, gini: 0.893, category: 'DeFi', voters: 88, platform: 'Snapshot' },
  'Prisma Finance': { grade: 'C', score: 62, gini: 0.810, category: 'DeFi', voters: 19, platform: 'Snapshot' },
  'Goldfinch': { grade: 'D', score: 55, gini: 0.872, category: 'DeFi', voters: 20, platform: 'Snapshot' },
  'Threshold': { grade: 'C', score: 68, gini: 0.827, category: 'DeFi', voters: 53, platform: 'Snapshot' },
  'Notional': { grade: 'C', score: 65, gini: 0.562, category: 'DeFi', voters: 5, platform: 'Snapshot' },
  'BendDAO': { grade: 'D', score: 50, gini: 0.587, category: 'DeFi', voters: 4, platform: 'Snapshot' },
  'Drops DAO': { grade: 'C', score: 68, gini: 0.733, category: 'DeFi', voters: 31, platform: 'Snapshot' },
  'Silo Finance': { grade: 'C', score: 70, gini: 0.890, category: 'DeFi', voters: 85, platform: 'Snapshot' },
  'Tokemak': { grade: 'D', score: 50, gini: 0.956, category: 'DeFi', voters: 181, platform: 'Snapshot' },
  'ShapeShift': { grade: 'C', score: 70, gini: 0.778, category: 'DeFi', voters: 51, platform: 'Snapshot' },
  'Starknet': { grade: 'B', score: 78, gini: 0.850, category: 'L2', voters: 160, platform: 'Snapshot' },
};

/**
 * Classify governance architecture per the "Four Architectures of
 * Whale-Resistant Governance" research and the HB#317 category-split
 * refinement. Currently 5 entries are classified `discrete`:
 *   1. POP-platform DAOs (participation-token issuance)
 *   2. Nouns (NFT-per-vote auction)
 *   3. Sismo (identity badge)
 *   4. Aavegotchi (gameplay-tied tokens)
 *   5. Loopring (early-distribution LRC; reclassified HB#300 after
 *      falsification test showed it has discrete-cluster temporal
 *      stability despite Snapshot platform tag)
 * Everything else is divisible token-weighted.
 *
 * The discrete/divisible classifier is about SUBSTRATE not PLATFORM.
 * A DAO can be on Snapshot but discrete (Loopring) or on POP-equivalent
 * voting infrastructure but divisible if its tokens are tradeable.
 */
export function architectureClass(name: string, platform: string): ArchitectureClass {
  if (platform === 'POP') return 'discrete';
  if (name === 'Nouns') return 'discrete';
  if (name === 'Sismo') return 'discrete';
  if (name === 'Aavegotchi') return 'discrete';
  if (name === 'Loopring') return 'discrete';
  return 'divisible';
}
