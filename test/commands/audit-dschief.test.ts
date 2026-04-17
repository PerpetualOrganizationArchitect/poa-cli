import { describe, it, expect } from 'vitest';
import {
  aggregateLockEvents,
  computeGini,
  deriveTopVoters,
} from '../../src/commands/org/audit-dschief';

const WEI_PER_MKR = 10n ** 18n;
const MKR = (n: number | bigint): bigint => BigInt(Math.floor(Number(n) * 100)) * (WEI_PER_MKR / 100n);

describe('audit-dschief pure helpers', () => {
  describe('aggregateLockEvents', () => {
    it('returns empty map for empty inputs', () => {
      expect(aggregateLockEvents([], []).size).toBe(0);
    });

    it('sums locks for a single voter', () => {
      const locks = [
        { voter: '0xABC', amount: MKR(100) },
        { voter: '0xABC', amount: MKR(50) },
      ];
      const result = aggregateLockEvents(locks, []);
      expect(result.get('0xabc')).toBe(150);
    });

    it('subtracts frees from locks', () => {
      const locks = [{ voter: '0xABC', amount: MKR(100) }];
      const frees = [{ voter: '0xabc', amount: MKR(30) }];
      const result = aggregateLockEvents(locks, frees);
      expect(result.get('0xabc')).toBe(70);
    });

    it('lowercases addresses for consistent keying', () => {
      const locks = [
        { voter: '0xABC', amount: MKR(50) },
        { voter: '0xabc', amount: MKR(50) },
      ];
      const result = aggregateLockEvents(locks, []);
      expect(result.size).toBe(1);
      expect(result.get('0xabc')).toBe(100);
    });

    it('clamps negative net weight to 0 (defensive: partial scans can see free-before-lock)', () => {
      const locks = [{ voter: '0xABC', amount: MKR(10) }];
      const frees = [{ voter: '0xABC', amount: MKR(50) }];
      const result = aggregateLockEvents(locks, frees);
      expect(result.get('0xabc')).toBe(0);
    });

    it('tracks multiple voters independently', () => {
      const locks = [
        { voter: '0xAAA', amount: MKR(100) },
        { voter: '0xBBB', amount: MKR(200) },
        { voter: '0xCCC', amount: MKR(50) },
      ];
      const result = aggregateLockEvents(locks, []);
      expect(result.size).toBe(3);
      expect(result.get('0xaaa')).toBe(100);
      expect(result.get('0xbbb')).toBe(200);
      expect(result.get('0xccc')).toBe(50);
    });
  });

  describe('computeGini', () => {
    it('returns 0 for empty array', () => {
      expect(computeGini([])).toBe(0);
    });

    it('returns 0 for single holder', () => {
      expect(computeGini([1000])).toBe(0);
    });

    it('returns 0 for perfectly equal distribution', () => {
      expect(computeGini([100, 100, 100, 100])).toBe(0);
    });

    it('approaches 1 for extreme concentration', () => {
      // 999 holders at 0.01, 1 holder at huge amount
      const weights = Array(999).fill(0.01);
      weights.push(1_000_000);
      const g = computeGini(weights);
      expect(g).toBeGreaterThan(0.95);
    });

    it('computes reasonable Gini for known 50/50 split with 2 holders', () => {
      // 2 equal holders → Gini should be 0
      expect(computeGini([100, 100])).toBe(0);
    });

    it('computes reasonable Gini for 80/20 split', () => {
      // classic Pareto-like inequality
      const g = computeGini([80, 20]);
      // Gini for (20, 80) sorted = 0.3 per formula
      expect(g).toBeCloseTo(0.3, 2);
    });

    it('ignores zero weights', () => {
      const withZeros = computeGini([0, 0, 100, 100]);
      const withoutZeros = computeGini([100, 100]);
      expect(withZeros).toBe(withoutZeros);
    });

    it('is stable under ordering (returns same value for shuffled input)', () => {
      const asc = computeGini([1, 2, 3, 4, 5]);
      const desc = computeGini([5, 4, 3, 2, 1]);
      const shuf = computeGini([3, 1, 5, 2, 4]);
      expect(asc).toBeCloseTo(desc, 10);
      expect(asc).toBeCloseTo(shuf, 10);
    });
  });

  describe('deriveTopVoters', () => {
    it('returns empty top / zero shares for empty weights', () => {
      const r = deriveTopVoters(new Map(), 5);
      expect(r.top).toEqual([]);
      expect(r.top1Share).toBe(0);
      expect(r.top5Share).toBe(0);
    });

    it('orders top voters by weight descending', () => {
      const weights = new Map([
        ['0xLow', 10],
        ['0xHigh', 100],
        ['0xMid', 50],
      ]);
      const r = deriveTopVoters(weights, 5);
      expect(r.top.map((v) => v.address)).toEqual(['0xHigh', '0xMid', '0xLow']);
    });

    it('computes shares as percentages summing to ≤100%', () => {
      const weights = new Map([
        ['0xA', 40],
        ['0xB', 30],
        ['0xC', 30],
      ]);
      const r = deriveTopVoters(weights, 5);
      expect(r.top[0].sharePct).toBeCloseTo(40, 1);
      expect(r.top5Share).toBeCloseTo(100, 1);
    });

    it('limits to topN when more voters exist', () => {
      const weights = new Map();
      for (let i = 1; i <= 10; i++) weights.set(`0x${i}`, i * 10);
      const r = deriveTopVoters(weights, 3);
      expect(r.top.length).toBe(3);
      expect(r.top[0].address).toBe('0x10');
      expect(r.top[0].lockedMkr).toBe(100);
    });

    it('filters zero-weight voters from top', () => {
      const weights = new Map([
        ['0xA', 100],
        ['0xB', 0],
        ['0xC', 50],
      ]);
      const r = deriveTopVoters(weights, 5);
      expect(r.top.length).toBe(2);
      expect(r.top.map((v) => v.address)).toEqual(['0xA', '0xC']);
    });

    it('top5Share = 100% when top-5 covers entire positive set', () => {
      const weights = new Map([
        ['0xA', 50],
        ['0xB', 30],
        ['0xC', 20],
      ]);
      const r = deriveTopVoters(weights, 5);
      expect(r.top5Share).toBeCloseTo(100, 1);
      expect(r.top1Share).toBeCloseTo(50, 1);
    });

    it('top5Share < 100% when long tail exists', () => {
      const weights = new Map();
      for (let i = 1; i <= 10; i++) weights.set(`0x${i}`, 10);
      const r = deriveTopVoters(weights, 5);
      // 5 of 10 equal-weight holders = 50%
      expect(r.top5Share).toBeCloseTo(50, 1);
    });
  });

  describe('end-to-end: simulated MakerDAO Chief Spark-like profile', () => {
    it('produces expected Gini + top-N for a tiny voter set', () => {
      // Simulates the Spark HB#391 profile (6 voters, 3 wallets ~100%)
      const locks = [
        { voter: '0xDC5D42', amount: MKR(462) },
        { voter: '0xA31BC2', amount: MKR(314) },
        { voter: '0x881D9E', amount: MKR(224) },
        { voter: '0xTINY1', amount: MKR(0.001) },
        { voter: '0xTINY2', amount: MKR(0.001) },
        { voter: '0xTINY3', amount: MKR(0.001) },
      ];
      const weights = aggregateLockEvents(locks, []);
      const { top1Share, top5Share } = deriveTopVoters(weights, 5);
      const gini = computeGini(Array.from(weights.values()));

      // Expect top-3 to be near 100%, top-1 near 46%
      expect(top1Share).toBeGreaterThan(45);
      expect(top1Share).toBeLessThan(47);
      expect(top5Share).toBeGreaterThan(99.9);
      // Gini should reflect inequality — 3 big + 3 tiny holders is moderate Gini.
      // Actual real-world Spark Gini per HB#391 was 0.579 over 6 voters, but that
      // used voting-power (derived from token-weighted Snapshot), not raw MKR locks.
      // For our raw-locks approximation, 0.15 + is correct (3 similar-magnitude
      // top holders + 3 tiny tail = moderate, not extreme inequality).
      expect(gini).toBeGreaterThan(0.1);
      expect(gini).toBeLessThan(0.9);
    });
  });
});
