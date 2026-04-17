import { describe, it, expect } from 'vitest';
import { ethers } from 'ethers';
import {
  signBrainChangeV2,
  verifyBrainChangeV2,
  canonicalMessageV2,
  unwrapChangeBytesV2,
  computePriorityV2,
  packChanges,
  unpackChanges,
  extractDeltaChanges,
  BrainChangeEnvelopeV2,
} from '../../src/lib/brain-envelope-v2';

const TEST_KEY = '0x' + '1'.repeat(64);
const TEST_AUTHOR = new ethers.Wallet(TEST_KEY).address.toLowerCase();

const SAMPLE_CHANGE = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0xfa, 0xce]);
const PARENT_A = 'bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy';
const PARENT_B = 'bafkreidc4mtjsxlomzxr5jjpvmpd6mhq3xa7sx52qjhokytm3ujkfpvgby';

describe('brain-envelope-v2', () => {
  describe('canonicalMessageV2', () => {
    it('produces deterministic output regardless of parentCids input order', () => {
      const m1 = canonicalMessageV2(TEST_AUTHOR, 100, 5, [PARENT_A, PARENT_B], '0xdead');
      const m2 = canonicalMessageV2(TEST_AUTHOR, 100, 5, [PARENT_B, PARENT_A], '0xdead');
      expect(m1).toBe(m2);
    });

    it('lowercases author and changes', () => {
      const upper = canonicalMessageV2('0xABCDEF', 100, 5, [], '0xDEAD');
      const lower = canonicalMessageV2('0xabcdef', 100, 5, [], '0xdead');
      expect(upper).toBe(lower);
    });

    it('changes when version prefix differs (no v1↔v2 collision)', () => {
      const m = canonicalMessageV2(TEST_AUTHOR, 100, 5, [], '0xdead');
      expect(m.startsWith('pop-brain-change/v2|')).toBe(true);
      expect(m.includes('pop-brain-change/v1')).toBe(false);
    });
  });

  describe('signBrainChangeV2 + verifyBrainChangeV2', () => {
    it('round-trips: sign then verify recovers the author', async () => {
      const env = await signBrainChangeV2({
        changeBytes: SAMPLE_CHANGE,
        parentCids: [PARENT_A],
        priority: 2,
        privateKey: TEST_KEY,
        timestamp: 100,
      });
      expect(env.v).toBe(2);
      expect(env.author).toBe(TEST_AUTHOR);
      expect(env.priority).toBe(2);
      expect(env.parentCids).toEqual([PARENT_A]);
      expect(env.changes).toBe('0xdeadbeefface');
      expect(env.sig).toMatch(/^0x[0-9a-f]+$/i);
      expect(verifyBrainChangeV2(env)).toBe(TEST_AUTHOR);
    });

    it('sorts parentCids in the envelope', async () => {
      const env = await signBrainChangeV2({
        changeBytes: SAMPLE_CHANGE,
        parentCids: [PARENT_B, PARENT_A], // unsorted input
        priority: 3,
        privateKey: TEST_KEY,
        timestamp: 100,
      });
      const sorted = [PARENT_A, PARENT_B].sort();
      expect(env.parentCids).toEqual(sorted);
      expect(verifyBrainChangeV2(env)).toBe(TEST_AUTHOR);
    });

    it('verifies regardless of caller-provided parentCids order in the envelope', async () => {
      const env = await signBrainChangeV2({
        changeBytes: SAMPLE_CHANGE,
        parentCids: [PARENT_A, PARENT_B],
        priority: 2,
        privateKey: TEST_KEY,
        timestamp: 100,
      });
      // Tamper: swap parentCids order in the envelope (sig was over the sorted form)
      const swapped: BrainChangeEnvelopeV2 = { ...env, parentCids: [...env.parentCids].reverse() };
      // verifyBrainChangeV2 re-sorts before checking — should still verify.
      expect(verifyBrainChangeV2(swapped)).toBe(TEST_AUTHOR);
    });

    it('rejects mismatched signature (tampered changes)', async () => {
      const env = await signBrainChangeV2({
        changeBytes: SAMPLE_CHANGE,
        parentCids: [],
        priority: 1,
        privateKey: TEST_KEY,
        timestamp: 100,
      });
      const tampered: BrainChangeEnvelopeV2 = { ...env, changes: '0xcafebabe' };
      expect(() => verifyBrainChangeV2(tampered)).toThrow(/signature mismatch/);
    });

    it('rejects mismatched signature (tampered priority)', async () => {
      const env = await signBrainChangeV2({
        changeBytes: SAMPLE_CHANGE,
        parentCids: [],
        priority: 1,
        privateKey: TEST_KEY,
        timestamp: 100,
      });
      const tampered: BrainChangeEnvelopeV2 = { ...env, priority: 99 };
      expect(() => verifyBrainChangeV2(tampered)).toThrow(/signature mismatch/);
    });

    it('rejects v1 envelope shape (wrong v)', () => {
      const fake = { v: 1, author: TEST_AUTHOR, timestamp: 100, priority: 1,
                     parentCids: [], changes: '0xdead', sig: '0xbeef' } as any;
      expect(() => verifyBrainChangeV2(fake)).toThrow(/expected v=2/);
    });

    it('rejects malformed envelope (missing fields)', () => {
      const incomplete = { v: 2, author: TEST_AUTHOR, timestamp: 100 } as any;
      expect(() => verifyBrainChangeV2(incomplete)).toThrow(/malformed envelope/);
    });

    it('rejects priority < 1', async () => {
      await expect(signBrainChangeV2({
        changeBytes: SAMPLE_CHANGE,
        parentCids: [],
        priority: 0,
        privateKey: TEST_KEY,
      })).rejects.toThrow(/priority must be integer >= 1/);
    });
  });

  describe('unwrapChangeBytesV2', () => {
    it('round-trips bytes through hex encoding', async () => {
      const env = await signBrainChangeV2({
        changeBytes: SAMPLE_CHANGE,
        parentCids: [],
        priority: 1,
        privateKey: TEST_KEY,
        timestamp: 100,
      });
      const recovered = unwrapChangeBytesV2(env);
      expect(Array.from(recovered)).toEqual(Array.from(SAMPLE_CHANGE));
    });
  });

  describe('computePriorityV2', () => {
    it('returns 1 for genesis (no parents)', () => {
      expect(computePriorityV2([])).toBe(1);
    });
    it('returns max(parent.priority) + 1', () => {
      expect(computePriorityV2([{ priority: 3 }])).toBe(4);
      expect(computePriorityV2([{ priority: 5 }, { priority: 2 }, { priority: 7 }])).toBe(8);
    });
  });

  describe('packChanges / unpackChanges', () => {
it('round-trips empty array', () => {
      const packed = packChanges([]);
      expect(packed.length).toBe(0);
      expect(unpackChanges(packed)).toEqual([]);
    });

    it('round-trips a single change', () => {
      const ch = new Uint8Array([1, 2, 3, 4, 5]);
      const packed = packChanges([ch]);
      expect(packed.length).toBe(4 + 5);
      const recovered = unpackChanges(packed);
      expect(recovered.length).toBe(1);
      expect(Array.from(recovered[0])).toEqual([1, 2, 3, 4, 5]);
    });

    it('round-trips multiple changes preserving order', () => {
      const a = new Uint8Array([0xa, 0xb]);
      const b = new Uint8Array([0xc, 0xd, 0xe]);
      const c = new Uint8Array([0xf]);
      const recovered = unpackChanges(packChanges([a, b, c]));
      expect(recovered.length).toBe(3);
      expect(Array.from(recovered[0])).toEqual([0xa, 0xb]);
      expect(Array.from(recovered[1])).toEqual([0xc, 0xd, 0xe]);
      expect(Array.from(recovered[2])).toEqual([0xf]);
    });

    it('returned slices do not share memory with input', () => {
      const ch = new Uint8Array([0xff, 0xfe]);
      const packed = packChanges([ch]);
      const [recovered] = unpackChanges(packed);
      // Mutate the recovered buffer; original packed bytes should be unchanged.
      recovered[0] = 0;
      const [reRecovered] = unpackChanges(packed);
      expect(reRecovered[0]).toBe(0xff);
    });

    it('rejects truncated length prefix', () => {
      const malformed = new Uint8Array([0, 0]); // 2 bytes, less than 4-byte prefix
      expect(() => unpackChanges(malformed)).toThrow(/truncated length prefix/);
    });

    it('rejects length prefix exceeding buffer', () => {
      // length prefix says 100 bytes follow, but only 2 bytes remain
      const malformed = new Uint8Array([0, 0, 0, 100, 0xab, 0xcd]);
      expect(() => unpackChanges(malformed)).toThrow(/exceeds buffer/);
    });
  });

  describe('extractDeltaChanges', () => {
    it('returns all changes when before is undefined (genesis)', () => {
      const fakeAutomerge = {
        getAllChanges: (doc: any) => doc.changes as Uint8Array[],
        decodeChange: (c: Uint8Array) => ({ hash: c[0].toString(16) }),
      };
      const after = { changes: [new Uint8Array([0x1]), new Uint8Array([0x2])] };
const delta = extractDeltaChanges(undefined, after, fakeAutomerge);
      expect(delta.length).toBe(2);
    });

    it('returns only changes not in before (set difference by hash)', () => {
      const fakeAutomerge = {
        getAllChanges: (doc: any) => doc.changes as Uint8Array[],
        decodeChange: (c: Uint8Array) => ({ hash: c[0].toString(16) }),
      };
      const before = { changes: [new Uint8Array([0x1]), new Uint8Array([0x2])] };
      const after = {
        changes: [new Uint8Array([0x1]), new Uint8Array([0x2]), new Uint8Array([0x3]), new Uint8Array([0x4])],
      };
const delta = extractDeltaChanges(before, after, fakeAutomerge);
      expect(delta.length).toBe(2);
      expect(delta[0][0]).toBe(0x3);
      expect(delta[1][0]).toBe(0x4);
    });
  });
});
