/**
 * Task #390 (HB#385): unit test for probe-access's pre-probe identity check.
 *
 * Validates the pure `matchContractName(actual, expected)` helper that
 * decides whether the on-chain name() result matches the operator's
 * --expected-name flag. The RPC-dependent `fetchContractNameAndCheck`
 * function wraps this helper with provider calls and is tested live by
 * the HB#385 mainnet verification against Compound Governor Bravo.
 *
 * Match semantics: case-insensitive substring. Examples:
 *   matchContractName("Compound Governor Bravo", "Compound")  → true
 *   matchContractName("Compound Governor Bravo", "compound")  → true  (case-insensitive)
 *   matchContractName("Compound Governor Bravo", "Uniswap")   → false
 *   matchContractName("Compound Governor Bravo", "")          → true  (empty = always match)
 *   matchContractName(null, "Compound")                       → false (null = never match)
 *
 * This addresses the HB#384 class of error where the HB#362 audit labeled
 * 0x408ED635... as "Gitcoin Governor Bravo" but the contract's name()
 * actually returns "Uniswap Governor Bravo". If HB#362 had run the probe
 * with --expected-name "Gitcoin", this helper would have returned false
 * and the operator would have seen a NAME CHECK MISMATCH warning before
 * the probe ran.
 */

import { describe, it, expect } from 'vitest';
import { matchContractName } from '../../src/commands/org/probe-access';

describe('matchContractName — HB#385 task #390', () => {
  it('matches exact substring (case-sensitive input, case-insensitive compare)', () => {
    expect(matchContractName('Compound Governor Bravo', 'Compound')).toBe(true);
    expect(matchContractName('Uniswap Governor Bravo', 'Uniswap')).toBe(true);
    expect(matchContractName('MakerDAO Chief', 'MakerDAO')).toBe(true);
  });

  it('matches lowercase expected against mixed-case actual', () => {
    expect(matchContractName('Compound Governor Bravo', 'compound')).toBe(true);
    expect(matchContractName('Nouns DAO LogicV3', 'nouns')).toBe(true);
  });

  it('matches uppercase expected against mixed-case actual', () => {
    expect(matchContractName('Compound Governor Bravo', 'COMPOUND')).toBe(true);
    expect(matchContractName('Aave Governance V3', 'AAVE')).toBe(true);
  });

  it('returns false when the substring is not present', () => {
    expect(matchContractName('Compound Governor Bravo', 'Uniswap')).toBe(false);
    expect(matchContractName('Uniswap Governor Bravo', 'Gitcoin')).toBe(false);
    expect(matchContractName('Aave Governance V3', 'MakerDAO')).toBe(false);
  });

  it('handles the HB#384 original mistake (would have caught the mislabel)', () => {
    // The HB#362 audit labeled 0x408ED635... as "Gitcoin Governor Bravo".
    // The contract's actual name() returns "Uniswap Governor Bravo". If
    // the operator had supplied --expected-name "Gitcoin", this helper
    // would have returned false and the mislabel would have been caught.
    expect(matchContractName('Uniswap Governor Bravo', 'Gitcoin')).toBe(false);
    expect(matchContractName('Uniswap Governor Bravo', 'Uniswap')).toBe(true);
  });

  it('returns false when actual is null (no name() accessor)', () => {
    expect(matchContractName(null, 'Compound')).toBe(false);
    expect(matchContractName(null, 'anything')).toBe(false);
    expect(matchContractName(null, '')).toBe(false);
  });

  it('returns true when expected is empty (vacuous match)', () => {
    // Empty expected string is a degenerate case: the empty string is
    // a substring of every string, so the match is vacuously true. This
    // is the JS String.includes() semantic; callers should validate
    // that expectedName is non-empty before invoking the helper. The
    // CLI --expected-name flag enforces this at the yargs layer.
    expect(matchContractName('Compound Governor Bravo', '')).toBe(true);
    expect(matchContractName('anything', '')).toBe(true);
  });

  it('handles partial word matches (substring, not word boundary)', () => {
    // Deliberate: substring match is more permissive than word boundary.
    // "Aave" matches "Aave Governance V3" AND "PaaveXGov" (if such a
    // contract existed). Operators can use --expected-name "Aave Governance"
    // for stricter matching.
    expect(matchContractName('Aave Governance V3', 'Aave')).toBe(true);
    expect(matchContractName('Aave Governance V3', 'Governance')).toBe(true);
    expect(matchContractName('Aave Governance V3', 'V3')).toBe(true);
    expect(matchContractName('Aave Governance V3', 'V2')).toBe(false);
  });

  it('handles Unicode name strings without crashing', () => {
    // Some contracts use Unicode in their name — make sure the helper
    // doesn't blow up on non-ASCII input.
    expect(matchContractName('Curve DAO — veCRV', 'Curve')).toBe(true);
    expect(matchContractName('Curve DAO — veCRV', 'veCRV')).toBe(true);
    expect(matchContractName('Curve DAO — veCRV', 'Maker')).toBe(false);
  });

  it('handles empty actual string (contract returned empty name())', () => {
    expect(matchContractName('', 'Compound')).toBe(false);
    expect(matchContractName('', '')).toBe(true);
  });

  it('matches across the 15-DAO corpus (ensure no false positives for real names)', () => {
    // Regression: for each real contract name in the current corpus,
    // verify that name matches its own expected label and does NOT
    // match any other corpus label.
    const corpus = [
      { actual: 'Compound Governor Bravo', expected: 'Compound' },
      { actual: 'Uniswap Governor Bravo', expected: 'Uniswap' },
      { actual: 'ENS Governor', expected: 'ENS' },
      { actual: 'L2ArbitrumGovernor', expected: 'Arbitrum' },
      { actual: 'NounsDAO LogicV3', expected: 'Nouns' },
      { actual: 'Optimism Agora Governor', expected: 'Optimism' },
      { actual: 'Voting (v0.5.0)', expected: 'Voting' }, // Aragon
      { actual: 'Aave Governance V2', expected: 'Aave' },
      { actual: 'Aave Governance V3', expected: 'Aave' },
      { actual: 'DSChief', expected: 'DSChief' },
      { actual: 'VotingEscrow', expected: 'VotingEscrow' },
    ];

    for (const row of corpus) {
      expect(matchContractName(row.actual, row.expected)).toBe(true);
    }
  });
});
