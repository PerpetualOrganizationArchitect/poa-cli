import { describe, it, expect } from 'vitest';
import { ethers } from 'ethers';
import {
  signBrainChange,
  verifyBrainChange,
  unwrapAutomergeBytes,
  type BrainChangeEnvelope,
} from '../../src/lib/brain-signing';

// Pure-function tests only. Filesystem-backed helpers (loadAllowlist,
// isAllowedAuthor, authenticateAndAuthorize, getAllowlistPath) use
// process.cwd() directly and would require chdir() to test, which vitest
// workers reject with ERR_WORKER_UNSUPPORTED_OPERATION. Those helpers
// stay uncovered until a future refactor accepts the allowlist path
// via parameter injection.

const wallet = ethers.Wallet.createRandom();

describe('signBrainChange', () => {
  it('produces a well-shaped v1 envelope', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 0xde, 0xad]);
    const env = await signBrainChange(bytes, wallet.privateKey);
    expect(env.v).toBe(1);
    expect(env.author).toBe(wallet.address.toLowerCase());
    expect(env.automerge.startsWith('0x')).toBe(true);
    expect(env.sig.startsWith('0x')).toBe(true);
    expect(typeof env.timestamp).toBe('number');
    expect(env.timestamp).toBeGreaterThan(1_000_000_000);  // unix-seconds scale sanity
  });

  it('hex-encodes automerge bytes correctly', async () => {
    const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const env = await signBrainChange(bytes, wallet.privateKey);
    expect(env.automerge.toLowerCase()).toBe('0xdeadbeef');
  });

  it('produces different sigs for different content', async () => {
    const a = await signBrainChange(new Uint8Array([1]), wallet.privateKey);
    const b = await signBrainChange(new Uint8Array([2]), wallet.privateKey);
    expect(a.sig).not.toBe(b.sig);
  });

  it('throws if no private key (env + arg both missing)', async () => {
    const prior = process.env.POP_PRIVATE_KEY;
    delete process.env.POP_PRIVATE_KEY;
    try {
      await expect(signBrainChange(new Uint8Array([1]))).rejects.toThrow(/POP_PRIVATE_KEY/);
    } finally {
      if (prior !== undefined) process.env.POP_PRIVATE_KEY = prior;
    }
  });

  it('uses POP_PRIVATE_KEY env when arg omitted', async () => {
    const prior = process.env.POP_PRIVATE_KEY;
    process.env.POP_PRIVATE_KEY = wallet.privateKey;
    try {
      const env = await signBrainChange(new Uint8Array([1]));
      expect(env.author).toBe(wallet.address.toLowerCase());
    } finally {
      if (prior !== undefined) process.env.POP_PRIVATE_KEY = prior;
      else delete process.env.POP_PRIVATE_KEY;
    }
  });
});

describe('verifyBrainChange', () => {
  it('round-trips sig verify → author (lowercase)', async () => {
    const bytes = new Uint8Array([0xff]);
    const env = await signBrainChange(bytes, wallet.privateKey);
    const recovered = verifyBrainChange(env);
    expect(recovered).toBe(wallet.address.toLowerCase());
  });

  it('rejects a tampered timestamp', async () => {
    const env = await signBrainChange(new Uint8Array([1]), wallet.privateKey);
    const tampered = { ...env, timestamp: env.timestamp + 1 };
    expect(() => verifyBrainChange(tampered)).toThrow();
  });

  it('rejects a tampered automerge payload', async () => {
    const env = await signBrainChange(new Uint8Array([1]), wallet.privateKey);
    const tampered = { ...env, automerge: '0xdeadbeef' };
    expect(() => verifyBrainChange(tampered)).toThrow();
  });

  it('rejects a tampered author field', async () => {
    const env = await signBrainChange(new Uint8Array([1]), wallet.privateKey);
    const other = ethers.Wallet.createRandom();
    const tampered = { ...env, author: other.address.toLowerCase() };
    expect(() => verifyBrainChange(tampered)).toThrow();
  });

  it('rejects unsupported envelope version', () => {
    const bad = { v: 99, author: '0xabc', timestamp: 1, automerge: '0x00', sig: '0x00' } as any;
    expect(() => verifyBrainChange(bad)).toThrow(/Unsupported brain envelope version|expected v=1/i);
  });

  it('rejects malformed envelope (missing sig)', () => {
    const bad = { v: 1, author: '0xabc', timestamp: 1, automerge: '0x00', sig: '' } as any;
    expect(() => verifyBrainChange(bad)).toThrow();
  });

  it('rejects malformed envelope (missing automerge)', () => {
    const bad = { v: 1, author: '0xabc', timestamp: 1, automerge: '', sig: '0x00' } as any;
    expect(() => verifyBrainChange(bad)).toThrow();
  });
});

describe('unwrapAutomergeBytes', () => {
  it('restores original byte sequence', async () => {
    const original = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x00, 0x01, 0x02]);
    const env = await signBrainChange(original, wallet.privateKey);
    const unwrapped = unwrapAutomergeBytes(env);
    expect(Buffer.from(unwrapped).toString('hex')).toBe(Buffer.from(original).toString('hex'));
  });

  it('handles empty byte sequence', async () => {
    const env = await signBrainChange(new Uint8Array([]), wallet.privateKey);
    const unwrapped = unwrapAutomergeBytes(env);
    expect(unwrapped.length).toBe(0);
  });

  it('handles large byte sequences', async () => {
    const big = new Uint8Array(1024).map((_, i) => i & 0xff);
    const env = await signBrainChange(big, wallet.privateKey);
    const unwrapped = unwrapAutomergeBytes(env);
    expect(unwrapped.length).toBe(1024);
    expect(unwrapped[100]).toBe(100);
    expect(unwrapped[1023]).toBe(255);
  });
});
