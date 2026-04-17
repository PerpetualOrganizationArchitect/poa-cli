import { describe, it, expect } from 'vitest';
import {
  EOA_DELEGATION,
  PAYMASTER_HUB,
  encodePaymasterData,
  encodeCall,
} from '../../src/lib/sponsored';
import type { Hex } from 'viem';

// Network-dependent functions (isDelegated, delegateEOA, sendSponsored,
// getUserOpHash requires userOp fixtures) are excluded — these tests
// cover pure-encoding surface.

describe('constants', () => {
  it('EOA_DELEGATION is a 20-byte address', () => {
    expect(EOA_DELEGATION).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it('PAYMASTER_HUB is a 20-byte address', () => {
    expect(PAYMASTER_HUB).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it('EOA_DELEGATION matches canonical deployed address', () => {
    expect(EOA_DELEGATION).toBe('0x776ec88A88E86e38d54a985983377f1A2A25ef8b');
  });

  it('PAYMASTER_HUB matches canonical deployed address', () => {
    expect(PAYMASTER_HUB).toBe('0xdEf1038C297493c0b5f82F0CDB49e929B53B4108');
  });
});

describe('encodePaymasterData', () => {
  it('produces 78-byte (156 hex char + 0x prefix) output', () => {
    const orgId = ('0x' + '12'.repeat(32)) as Hex;
    const hatId = 0x30222100n;
    const encoded = encodePaymasterData(orgId, hatId);
    // 78 bytes = 156 hex chars + 0x = 158
    expect(encoded.length).toBe(158);
    expect(encoded.startsWith('0x')).toBe(true);
  });

  it('starts with version byte 0x01', () => {
    const encoded = encodePaymasterData(('0x' + '00'.repeat(32)) as Hex, 0n);
    expect(encoded.slice(0, 4)).toBe('0x01');
  });

  it('includes orgId in bytes 1-32', () => {
    const orgId = ('0xdeadbeef' + '00'.repeat(28)) as Hex;
    const encoded = encodePaymasterData(orgId, 0n);
    // After 0x01 version, next 32 bytes = 64 hex chars
    expect(encoded.slice(4, 4 + 64).toLowerCase()).toContain('deadbeef');
  });

  it('subjectType byte at position 33 = 0x01 (HAT)', () => {
    const encoded = encodePaymasterData(('0x' + '00'.repeat(32)) as Hex, 0n);
    // 0x prefix (2) + version (2 hex) + orgId (64 hex) = position 68
    expect(encoded.slice(68, 70)).toBe('01');
  });

  it('includes hatId in the next 32 bytes after subjectType', () => {
    const hatId = 0x30222100n;
    const encoded = encodePaymasterData(('0x' + '00'.repeat(32)) as Hex, hatId);
    // position 70 starts hatId (64 hex chars)
    const hatHex = encoded.slice(70, 70 + 64);
    expect(hatHex).toContain('30222100');
  });

  it('is deterministic — same input produces same output', () => {
    const orgId = ('0x' + '42'.repeat(32)) as Hex;
    const hatId = 123456789n;
    const a = encodePaymasterData(orgId, hatId);
    const b = encodePaymasterData(orgId, hatId);
    expect(a).toBe(b);
  });

  it('different hatIds produce different outputs', () => {
    const orgId = ('0x' + '00'.repeat(32)) as Hex;
    const a = encodePaymasterData(orgId, 1n);
    const b = encodePaymasterData(orgId, 2n);
    expect(a).not.toBe(b);
  });

  it('different orgIds produce different outputs', () => {
    const a = encodePaymasterData(('0x' + '11'.repeat(32)) as Hex, 0n);
    const b = encodePaymasterData(('0x' + '22'.repeat(32)) as Hex, 0n);
    expect(a).not.toBe(b);
  });

  it('ruleId trailing 4 bytes defaults to zero', () => {
    const encoded = encodePaymasterData(('0x' + '00'.repeat(32)) as Hex, 0n);
    // 0x prefix(2) + version(2) + orgId(64) + subjectType(2) + hatId(64) = position 134
    expect(encoded.slice(134, 134 + 8)).toBe('00000000');
  });

  it('mailboxCommit trailing 8 bytes defaults to zero', () => {
    const encoded = encodePaymasterData(('0x' + '00'.repeat(32)) as Hex, 0n);
    // position 142 = mailboxCommit (16 hex chars)
    expect(encoded.slice(142, 142 + 16)).toBe('0000000000000000');
  });
});

describe('encodeCall', () => {
  const abi = [
    { name: 'transfer', type: 'function', inputs: [
      { type: 'address', name: 'to' },
      { type: 'uint256', name: 'amount' },
    ], outputs: [{ type: 'bool' }] },
  ] as const;

  it('produces valid 0x-prefixed hex', () => {
    const data = encodeCall(abi as any, 'transfer', ['0x0000000000000000000000000000000000000001', 100n]);
    expect(data).toMatch(/^0x[0-9a-fA-F]+$/);
  });

  it('starts with transfer selector 0xa9059cbb', () => {
    const data = encodeCall(abi as any, 'transfer', ['0x0000000000000000000000000000000000000001', 100n]);
    expect(data.slice(0, 10)).toBe('0xa9059cbb');
  });

  it('throws on unknown function', () => {
    expect(() => encodeCall(abi as any, 'unknownFn', [])).toThrow();
  });
});
