import { describe, it, expect } from 'vitest';
import {
  computeRepeatVoteRatio,
  isCaptureClusterRuleB,
} from '../../src/commands/org/audit-participation';

describe('audit-participation rule-B metrics', () => {
  describe('computeRepeatVoteRatio', () => {
    it('returns 0 for empty window (uniqueVoters = 0)', () => {
      expect(computeRepeatVoteRatio(0, 0)).toBe(0);
      expect(computeRepeatVoteRatio(100, 0)).toBe(0);
    });

    it('returns 0 for negative unique-voter counts (defensive)', () => {
      expect(computeRepeatVoteRatio(50, -1)).toBe(0);
    });

    it('returns 1.0 when every voter voted exactly once (refreshing electorate)', () => {
      expect(computeRepeatVoteRatio(100, 100)).toBe(1);
      expect(computeRepeatVoteRatio(50, 50)).toBe(1);
    });

    it('matches the HB#256 corpus published values (real-world sanity)', () => {
      // Compound: 288 / 68 = 4.235... → 4.24
      expect(computeRepeatVoteRatio(288, 68)).toBe(4.24);
      // Nouns: 1218 / 143 = 8.517... → 8.52
      expect(computeRepeatVoteRatio(1218, 143)).toBe(8.52);
      // ENS: 363 / 233 = 1.557... → 1.56
      expect(computeRepeatVoteRatio(363, 233)).toBe(1.56);
      // Arbitrum: 17776 / 14021 = 1.267... → 1.27
      expect(computeRepeatVoteRatio(17776, 14021)).toBe(1.27);
    });

    it('rounds to 2 decimal places (stable for display + comparison)', () => {
      expect(computeRepeatVoteRatio(1, 3)).toBe(0.33); // 0.333... → 0.33
      expect(computeRepeatVoteRatio(2, 3)).toBe(0.67); // 0.666... → 0.67
    });
  });

  describe('isCaptureClusterRuleB', () => {
    it('returns true when ratio > 4 AND voters < 100', () => {
      expect(isCaptureClusterRuleB(4.24, 68)).toBe(true); // Compound
      expect(isCaptureClusterRuleB(5.0, 50)).toBe(true);
      expect(isCaptureClusterRuleB(10, 99)).toBe(true);
    });

    it('returns false when ratio <= 4 (first condition fails)', () => {
      expect(isCaptureClusterRuleB(4.0, 50)).toBe(false); // strict >
      expect(isCaptureClusterRuleB(3.99, 50)).toBe(false);
      expect(isCaptureClusterRuleB(1.56, 50)).toBe(false);
    });

    it('returns false when voters >= 100 (second condition fails)', () => {
      expect(isCaptureClusterRuleB(8.52, 143)).toBe(false); // Nouns — near-cluster
      expect(isCaptureClusterRuleB(10, 100)).toBe(false); // strict <
      expect(isCaptureClusterRuleB(10, 1000)).toBe(false);
    });

    it('corpus-level reproduces published cluster membership', () => {
      // From capture-cluster-rule-b-proposal.md validation table:
      // Only Compound enters by rule B with the strict <100 threshold.
      const corpus = [
        { name: 'Arbitrum', ratio: 1.27, voters: 14021, expected: false },
        { name: 'Uniswap', ratio: 1.47, voters: 2254, expected: false },
        { name: 'ENS', ratio: 1.56, voters: 233, expected: false },
        { name: 'Gitcoin', ratio: 1.21, voters: 312, expected: false },
        { name: 'Nouns', ratio: 8.52, voters: 143, expected: false }, // near-cluster
        { name: 'Compound', ratio: 4.24, voters: 68, expected: true },
      ];
      for (const row of corpus) {
        expect(
          isCaptureClusterRuleB(row.ratio, row.voters),
          `${row.name}: ratio=${row.ratio} voters=${row.voters}`,
        ).toBe(row.expected);
      }
    });
  });
});
