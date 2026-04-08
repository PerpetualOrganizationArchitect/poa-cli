import { describe, it, expect } from 'vitest';
import {
  requireArg,
  requireAddress,
  requirePositiveNumber,
  requireValidUsername,
} from '../../src/lib/validation';

describe('requireArg', () => {
  it('returns value if present', () => {
    expect(requireArg('hello', 'test')).toBe('hello');
    expect(requireArg(42, 'test')).toBe(42);
  });

  it('throws on undefined/null/empty', () => {
    expect(() => requireArg(undefined, 'test')).toThrow('--test');
    expect(() => requireArg(null, 'test')).toThrow('--test');
    expect(() => requireArg('', 'test')).toThrow('--test');
  });
});

describe('requireAddress', () => {
  it('returns checksummed address', () => {
    const result = requireAddress('0xaf88d065e77c8cc2239327c5edb3a432268e5831', 'addr');
    expect(result).toBe('0xaf88d065e77c8cC2239327C5EDb3A432268e5831');
  });

  it('throws on invalid', () => {
    expect(() => requireAddress('not-valid', 'addr')).toThrow('Invalid address');
    expect(() => requireAddress('0x123', 'addr')).toThrow('Invalid address');
  });
});

describe('requirePositiveNumber', () => {
  it('accepts positive numbers', () => {
    expect(requirePositiveNumber(5, 'n')).toBe(5);
    expect(requirePositiveNumber(0.1, 'n')).toBe(0.1);
    expect(requirePositiveNumber('10', 'n')).toBe(10);
  });

  it('rejects zero, negative, NaN, Infinity', () => {
    expect(() => requirePositiveNumber(0, 'n')).toThrow('positive');
    expect(() => requirePositiveNumber(-1, 'n')).toThrow('positive');
    expect(() => requirePositiveNumber(NaN, 'n')).toThrow('positive');
    expect(() => requirePositiveNumber(Infinity, 'n')).toThrow('positive finite');
    expect(() => requirePositiveNumber('abc', 'n')).toThrow('positive');
  });
});

describe('requireValidUsername', () => {
  it('accepts valid usernames', () => {
    expect(requireValidUsername('alice')).toBe('alice');
    expect(requireValidUsername('Bob_123')).toBe('Bob_123');
    expect(requireValidUsername('abc')).toBe('abc');
  });

  it('rejects too short', () => {
    expect(() => requireValidUsername('ab')).toThrow('3-32');
  });

  it('rejects too long', () => {
    expect(() => requireValidUsername('a'.repeat(33))).toThrow('3-32');
  });

  it('rejects special characters', () => {
    expect(() => requireValidUsername('user@name')).toThrow('letters, numbers');
    expect(() => requireValidUsername('user-name')).toThrow('letters, numbers');
    expect(() => requireValidUsername('user name')).toThrow('letters, numbers');
  });
});
