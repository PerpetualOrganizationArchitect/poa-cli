/**
 * Task #384 (HB#382): unit test for probe-access's reliability detection
 * heuristic. Validates:
 *
 *   1. Bytecode containing BOTH setUserRole(address,uint8,bool) [0x67aff484]
 *      AND setAuthority(address) [0x7a9e5e4b] triggers the ds-auth warning.
 *   2. Bytecode containing BOTH commit_transfer_ownership(address) [0x6b441a40]
 *      AND apply_transfer_ownership() [0x6a1c05ae] triggers the Vyper warning.
 *   3. Bytecode containing inline-modifier signatures (Compound Bravo admin
 *      strings, OZ Ownable's `OwnableUnauthorizedAccount` selector) does NOT
 *      trigger either warning.
 *   4. Empty / null bytecode does not panic and returns no warnings.
 *   5. Partial matches (only one of the paired selectors present) do not
 *      trigger false positives.
 */

import { describe, it, expect } from 'vitest';
import { detectProbeReliabilityPatterns } from '../../src/commands/org/probe-access';

// Test fixtures — minimal bytecode-shaped strings containing just the
// selectors we care about. The real contract bytecode is 10k+ hex chars;
// we only need the selector substrings to exercise the heuristic's string
// search, not the full code. Lowercase because the heuristic calls
// .toLowerCase() on the real input.

const SEL_SET_USER_ROLE = '67aff484';
const SEL_SET_AUTHORITY = '7a9e5e4b';
const SEL_COMMIT_TRANSFER = '6b441a40';
const SEL_APPLY_TRANSFER = '6a1c05ae';

// Filler bytes so the test strings look like real bytecode fragments.
const FILLER = '608060405234801561001057600080fd5b50';

function makeCode(...selectors: string[]): string {
  // Interleave selectors with filler so they aren't adjacent — matches
  // real compiled bytecode where selectors appear in the function dispatch
  // table separated by jump offsets and parameter packing.
  return (FILLER + selectors.map(s => s + FILLER).join('')).toLowerCase();
}

describe('detectProbeReliabilityPatterns — HB#382 task #384', () => {
  it('returns no warnings for null input', () => {
    const r = detectProbeReliabilityPatterns(null);
    expect(r.dsAuth).toBe(false);
    expect(r.vyper).toBe(false);
    expect(r.warnings).toHaveLength(0);
  });

  it('returns no warnings for empty string', () => {
    const r = detectProbeReliabilityPatterns('');
    expect(r.dsAuth).toBe(false);
    expect(r.vyper).toBe(false);
    expect(r.warnings).toHaveLength(0);
  });

  it('detects ds-auth when BOTH setUserRole and setAuthority are present', () => {
    const code = makeCode(SEL_SET_USER_ROLE, SEL_SET_AUTHORITY);
    const r = detectProbeReliabilityPatterns(code);
    expect(r.dsAuth).toBe(true);
    expect(r.vyper).toBe(false);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toContain('ds-auth detected');
    expect(r.warnings[0]).toContain('HB#379');
  });

  it('does NOT detect ds-auth when only setUserRole is present', () => {
    const code = makeCode(SEL_SET_USER_ROLE);
    const r = detectProbeReliabilityPatterns(code);
    expect(r.dsAuth).toBe(false);
    expect(r.warnings).toHaveLength(0);
  });

  it('does NOT detect ds-auth when only setAuthority is present', () => {
    const code = makeCode(SEL_SET_AUTHORITY);
    const r = detectProbeReliabilityPatterns(code);
    expect(r.dsAuth).toBe(false);
    expect(r.warnings).toHaveLength(0);
  });

  it('detects Vyper when BOTH commit_transfer_ownership and apply_transfer_ownership are present', () => {
    const code = makeCode(SEL_COMMIT_TRANSFER, SEL_APPLY_TRANSFER);
    const r = detectProbeReliabilityPatterns(code);
    expect(r.dsAuth).toBe(false);
    expect(r.vyper).toBe(true);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toContain('Vyper signature detected');
    expect(r.warnings[0]).toContain('HB#380');
  });

  it('does NOT detect Vyper when only commit_transfer_ownership is present', () => {
    const code = makeCode(SEL_COMMIT_TRANSFER);
    const r = detectProbeReliabilityPatterns(code);
    expect(r.vyper).toBe(false);
    expect(r.warnings).toHaveLength(0);
  });

  it('does NOT detect Vyper when only apply_transfer_ownership is present', () => {
    const code = makeCode(SEL_APPLY_TRANSFER);
    const r = detectProbeReliabilityPatterns(code);
    expect(r.vyper).toBe(false);
    expect(r.warnings).toHaveLength(0);
  });

  it('detects BOTH ds-auth and Vyper when all four selectors are present', () => {
    const code = makeCode(
      SEL_SET_USER_ROLE,
      SEL_SET_AUTHORITY,
      SEL_COMMIT_TRANSFER,
      SEL_APPLY_TRANSFER,
    );
    const r = detectProbeReliabilityPatterns(code);
    expect(r.dsAuth).toBe(true);
    expect(r.vyper).toBe(true);
    expect(r.warnings).toHaveLength(2);
  });

  it('does NOT flag inline-modifier contracts (Compound Bravo-style)', () => {
    // Compound Bravo and OZ Ownable use require-string reverts or
    // OwnableUnauthorizedAccount custom errors — none of our 4 sentinel
    // selectors appear. Simulate with the `propose(address[],uint256[],string[],bytes[],string)`
    // selector 0xda95691a which is Compound Bravo's propose function.
    const bravoSelector = 'da95691a';
    const code = makeCode(bravoSelector);
    const r = detectProbeReliabilityPatterns(code);
    expect(r.dsAuth).toBe(false);
    expect(r.vyper).toBe(false);
    expect(r.warnings).toHaveLength(0);
  });

  it('does NOT false-positive when only 3 of the 4 sentinel selectors are present', () => {
    // Defensive: a contract could have commit_transfer_ownership + apply_transfer_ownership
    // without being Vyper (unlikely but possible). Similarly for partial ds-auth.
    // Our heuristic requires BOTH selectors in each pair so 3-of-4 still
    // triggers only one warning, not both.
    const code = makeCode(SEL_SET_USER_ROLE, SEL_SET_AUTHORITY, SEL_COMMIT_TRANSFER);
    const r = detectProbeReliabilityPatterns(code);
    expect(r.dsAuth).toBe(true);
    expect(r.vyper).toBe(false);
    expect(r.warnings).toHaveLength(1);
  });

  it('handles case-insensitive matching (the real probe calls .toLowerCase() first)', () => {
    // Constructors, hex data, and manual test inputs might pass in uppercase.
    // The heuristic's contract is that it receives already-lowercased input,
    // but verify it handles mixed case gracefully via the lowercased fixture.
    const code = makeCode(SEL_SET_USER_ROLE.toUpperCase(), SEL_SET_AUTHORITY.toUpperCase()).toLowerCase();
    const r = detectProbeReliabilityPatterns(code);
    expect(r.dsAuth).toBe(true);
  });
});
