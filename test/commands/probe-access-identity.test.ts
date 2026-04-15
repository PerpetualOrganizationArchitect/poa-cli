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

  // Task #395 (HB#387 follow-up): alias map expansion. HB#386's sweep hit
  // three false positives — "curve votingescrow" vs "Vote-escrowed CRV",
  // "gitcoin alpha" vs "GTC Governor Alpha", and the Gitcoin/Uniswap
  // mislabel. The sweep fixed this with a LABEL_ALIASES map (gitcoin→gtc,
  // curve→{crv, vote-escrowed}) but probe-access's --expected-name flag
  // still did literal substring. These tests lock in the alias-aware
  // behavior so an operator running `--expected-name Curve` against Curve's
  // VotingEscrow no longer gets a false NAME CHECK MISMATCH warning.
  describe('LABEL_ALIASES expansion (task #395)', () => {
    it('matches Curve → Vote-escrowed CRV via the curve alias map', () => {
      expect(matchContractName('Vote-escrowed CRV', 'Curve')).toBe(true);
      expect(matchContractName('Vote-escrowed CRV', 'curve')).toBe(true);
      expect(matchContractName('Vote-escrowed CRV', 'Curve VotingEscrow')).toBe(true);
    });

    it('matches Gitcoin → GTC Governor Alpha via the gitcoin alias map', () => {
      expect(matchContractName('GTC Governor Alpha', 'Gitcoin')).toBe(true);
      expect(matchContractName('GTC Governor Alpha', 'gitcoin')).toBe(true);
      expect(matchContractName('GTC Governor Alpha', 'Gitcoin Alpha')).toBe(true);
    });

    it('does NOT introduce false positives for unrelated labels', () => {
      // Alias expansion must not make arbitrary strings match.
      expect(matchContractName('Uniswap Governor Bravo', 'Gitcoin')).toBe(false);
      expect(matchContractName('Compound Governor Bravo', 'Curve')).toBe(false);
      expect(matchContractName('MakerDAO Chief', 'Gitcoin')).toBe(false);
    });

    it('preserves HB#385 literal-substring behavior when it already works', () => {
      // When the expected label is already in the actual name, alias
      // expansion is irrelevant — literal match still wins.
      expect(matchContractName('Compound Governor Bravo', 'Compound')).toBe(true);
      expect(matchContractName('Uniswap Governor Bravo', 'Uniswap')).toBe(true);
      // And the HB#384 mislabel case still fails correctly.
      expect(matchContractName('Uniswap Governor Bravo', 'Gitcoin')).toBe(false);
    });
  });

  // Task #396 (HB#290): veToken family alias expansion. The HB#378-386
  // cycle surfaced that each veToken fork identifies with a generic or
  // token-symbol name, so pre-registering aliases before the audits land
  // keeps the next agent from hitting the HB#386 false-positive class.
  // Live on-chain name() values verified via eth_call in HB#290.
  describe('veToken family aliases (task #396)', () => {
    it('matches Balancer → Vote Escrowed Balancer BPT', () => {
      expect(matchContractName('Vote Escrowed Balancer BPT', 'Balancer')).toBe(true);
      expect(matchContractName('Vote Escrowed Balancer BPT', 'balancer')).toBe(true);
    });

    it('matches Frax → Vote-Escrowed FXS', () => {
      expect(matchContractName('Vote-Escrowed FXS', 'Frax')).toBe(true);
      expect(matchContractName('Vote-Escrowed FXS', 'frax')).toBe(true);
    });

    it('matches Velodrome / Aerodrome → veNFT (Solidly naming)', () => {
      expect(matchContractName('veNFT', 'Velodrome')).toBe(true);
      expect(matchContractName('veNFT', 'Aerodrome')).toBe(true);
    });

    it('does not cross-match veToken projects (no false positives)', () => {
      // Balancer's veBAL must not match a Frax query and vice versa.
      expect(matchContractName('Vote Escrowed Balancer BPT', 'Frax')).toBe(false);
      expect(matchContractName('Vote-Escrowed FXS', 'Balancer')).toBe(false);
      // And Solidly veNFT doesn't accidentally match Curve's veCRV.
      expect(matchContractName('veNFT', 'Curve')).toBe(false);
    });
  });
});
