/**
 * Unit tests for src/lib/brain.ts derivePortFromHash (task #447).
 *
 * Extracted as a pure helper in HB#319 (vigil) via Step 2.8 Q5 reflection:
 * the derivation logic shipped in HB#286 + widened in HB#290 had no unit
 * test coverage. This file closes the gap.
 *
 * Covers:
 * - Deterministic output for identical inputs
 * - Range bounds (34000 <= port < 44000)
 * - Distribution across boundary offsets (first/last byte combinations)
 * - Rejection of undersized inputs
 */

import { describe, it, expect } from 'vitest';
import { derivePortFromHash } from '../../src/lib/brain';

describe('derivePortFromHash', () => {
  it('is deterministic: same input → same output', () => {
    const hash = new Uint8Array([0x12, 0x34, 0xAB, 0xCD]);
    expect(derivePortFromHash(hash)).toBe(derivePortFromHash(hash));
  });

  it('always returns a port in the 34000-43999 range', () => {
    // Sample 20 random-ish 32-byte hashes via deterministic seeds.
    for (let i = 0; i < 20; i++) {
      const hash = new Uint8Array(32);
      for (let j = 0; j < 32; j++) hash[j] = (i * 31 + j * 7) & 0xff;
      const port = derivePortFromHash(hash);
      expect(port).toBeGreaterThanOrEqual(34000);
      expect(port).toBeLessThan(44000);
    }
  });

  it('handles [0x00, 0x00] at the low boundary → port 34000', () => {
    const hash = new Uint8Array([0, 0, ...new Array(30).fill(0)]);
    expect(derivePortFromHash(hash)).toBe(34000);
  });

  it('handles [0xFF, 0xFF] which maxes the 16-bit window → 34000 + (65535 % 10000) = 39535', () => {
    const hash = new Uint8Array([0xFF, 0xFF, ...new Array(30).fill(0)]);
    expect(derivePortFromHash(hash)).toBe(34000 + (65535 % 10000));
    expect(derivePortFromHash(hash)).toBe(39535);
  });

  it('is sensitive to the first byte (distinguishes hashes with same 2nd byte)', () => {
    const a = new Uint8Array([0x01, 0x00]);
    const b = new Uint8Array([0x02, 0x00]);
    expect(derivePortFromHash(a)).not.toBe(derivePortFromHash(b));
  });

  it('is sensitive to the second byte (distinguishes hashes with same 1st byte)', () => {
    const a = new Uint8Array([0x05, 0x10]);
    const b = new Uint8Array([0x05, 0x11]);
    expect(derivePortFromHash(a)).not.toBe(derivePortFromHash(b));
  });

  it('ignores bytes beyond index 1 (only first 2 bytes are used)', () => {
    const a = new Uint8Array([0x12, 0x34, 0x00, 0x00]);
    const b = new Uint8Array([0x12, 0x34, 0xFF, 0xFF]);
    expect(derivePortFromHash(a)).toBe(derivePortFromHash(b));
  });

  it('throws on empty hash', () => {
    expect(() => derivePortFromHash(new Uint8Array(0))).toThrow(/at least 2 bytes/);
  });

  it('throws on 1-byte hash', () => {
    expect(() => derivePortFromHash(new Uint8Array([0xAB]))).toThrow(/at least 2 bytes/);
  });

  it('works on exactly 2-byte hash (minimum valid input)', () => {
    expect(derivePortFromHash(new Uint8Array([0x00, 0x01]))).toBe(34001);
  });

  it('collision probability matches spec (1-in-10000)', () => {
    // Two specific hash prefixes known to collide modulo 10000:
    //   ((0x00 << 8) | 0x01) = 1           → port 34001
    //   (((10000+1) & 0xFFFF) in bytes = 0x27, 0x11) → 0x2711 = 10001, % 10000 = 1 → port 34001
    const a = new Uint8Array([0x00, 0x01]);
    const b = new Uint8Array([0x27, 0x11]);
    expect(derivePortFromHash(a)).toBe(derivePortFromHash(b));
    expect(derivePortFromHash(a)).toBe(34001);
  });
});
