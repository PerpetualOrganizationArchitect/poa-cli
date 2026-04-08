import { describe, it, expect } from 'vitest';
import { ethers } from 'ethers';
import {
  stringToBytes,
  bytesToString,
  stringToBytes32,
  ipfsCidToBytes32,
  bytes32ToIpfsCid,
  parseTaskId,
  parseModuleId,
  parseProjectId,
  formatAddress,
  isValidAddress,
} from '../../src/lib/encoding';

describe('stringToBytes / bytesToString', () => {
  it('round-trips ASCII', () => {
    const original = 'Hello World';
    const bytes = stringToBytes(original);
    expect(bytesToString(bytes)).toBe(original);
  });

  it('round-trips UTF-8', () => {
    const original = 'Héllo Wörld 🌍';
    const bytes = stringToBytes(original);
    expect(bytesToString(bytes)).toBe(original);
  });

  it('handles empty string', () => {
    const bytes = stringToBytes('');
    expect(bytesToString(bytes)).toBe('');
  });
});

describe('stringToBytes32', () => {
  it('returns HashZero for empty input', () => {
    expect(stringToBytes32('')).toBe(ethers.constants.HashZero);
  });

  it('returns keccak256 hash', () => {
    const result = stringToBytes32('test');
    expect(result).toMatch(/^0x[a-f0-9]{64}$/);
    expect(result).toBe(ethers.utils.keccak256(ethers.utils.toUtf8Bytes('test')));
  });
});

describe('ipfsCidToBytes32 / bytes32ToIpfsCid', () => {
  // Known CID from the POP ecosystem
  const knownCid = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG';

  it('converts CIDv0 to bytes32 and back', () => {
    const bytes32 = ipfsCidToBytes32(knownCid);
    expect(bytes32).toMatch(/^0x[a-f0-9]{64}$/);
    expect(bytes32).not.toBe(ethers.constants.HashZero);

    const cid = bytes32ToIpfsCid(bytes32);
    expect(cid).toBe(knownCid);
  });

  it('returns HashZero for empty input', () => {
    expect(ipfsCidToBytes32('')).toBe(ethers.constants.HashZero);
    expect(ipfsCidToBytes32(null as any)).toBe(ethers.constants.HashZero);
  });

  it('returns null for HashZero', () => {
    expect(bytes32ToIpfsCid(ethers.constants.HashZero)).toBeNull();
    expect(bytes32ToIpfsCid(null as any)).toBeNull();
  });

  it('passes through existing bytes32', () => {
    const hex = '0x' + 'ab'.repeat(32);
    expect(ipfsCidToBytes32(hex)).toBe(hex);
  });

  it('hashes non-CID strings as fallback', () => {
    const result = ipfsCidToBytes32('not-a-cid');
    expect(result).toMatch(/^0x[a-f0-9]{64}$/);
    // Should be keccak256 of the string
    expect(result).toBe(stringToBytes32('not-a-cid'));
  });
});

describe('parseTaskId', () => {
  it('extracts numeric ID from composite format', () => {
    expect(parseTaskId('0x1234567890abcdef-42')).toBe('42');
  });

  it('returns plain ID as-is', () => {
    expect(parseTaskId('7')).toBe('7');
    expect(parseTaskId(7)).toBe('7');
  });

  it('throws on empty result', () => {
    expect(() => parseTaskId('prefix-')).toThrow('Invalid task ID');
  });
});

describe('parseModuleId', () => {
  it('extracts ID from composite', () => {
    expect(parseModuleId('0xabc-3')).toBe('3');
  });

  it('returns plain ID', () => {
    expect(parseModuleId('1')).toBe('1');
  });
});

describe('parseProjectId', () => {
  it('returns bytes32 hex as-is', () => {
    const hex = '0x' + '00'.repeat(32);
    expect(parseProjectId(hex)).toBe(hex);
  });

  it('extracts from subgraph composite format', () => {
    const contractAddr = '0x' + 'ab'.repeat(20);
    const projectHex = '0x' + 'cd'.repeat(32);
    const composite = `${contractAddr}-${projectHex}`;
    expect(parseProjectId(composite)).toBe(projectHex);
  });

  it('returns HashZero for empty input', () => {
    expect(parseProjectId('')).toBe(ethers.constants.HashZero);
  });

  it('hashes plain string names', () => {
    const result = parseProjectId('my-project');
    expect(result).toMatch(/^0x[a-f0-9]{64}$/);
  });
});

describe('formatAddress', () => {
  it('shortens address', () => {
    expect(formatAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe('0x1234...5678');
  });

  it('returns empty for null', () => {
    expect(formatAddress('')).toBe('');
  });
});

describe('isValidAddress', () => {
  it('validates checksummed address', () => {
    expect(isValidAddress('0xaf88d065e77c8cC2239327C5EDb3A432268e5831')).toBe(true);
  });

  it('rejects invalid', () => {
    expect(isValidAddress('not-an-address')).toBe(false);
    expect(isValidAddress('0x123')).toBe(false);
  });
});
