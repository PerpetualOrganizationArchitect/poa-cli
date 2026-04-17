import { describe, it, expect } from 'vitest';
import { resolveUserAddress } from '../../src/lib/users';

describe('users', () => {
  describe('resolveUserAddress — hex short-circuit', () => {
    it('returns lowercased address for valid checksummed hex', async () => {
      const addr = await resolveUserAddress('0xC04C860454e73a9Ba524783aCbC7f7D6F5767eb6');
      expect(addr).toBe('0xc04c860454e73a9ba524783acbc7f7d6f5767eb6');
    });

    it('returns lowercased address for all-lowercase hex (idempotent)', async () => {
      const addr = await resolveUserAddress('0xc04c860454e73a9ba524783acbc7f7d6f5767eb6');
      expect(addr).toBe('0xc04c860454e73a9ba524783acbc7f7d6f5767eb6');
    });

    it('returns lowercased address for all-uppercase hex', async () => {
      const addr = await resolveUserAddress('0xC04C860454E73A9BA524783ACBC7F7D6F5767EB6');
      expect(addr).toBe('0xc04c860454e73a9ba524783acbc7f7d6f5767eb6');
    });

    it('returns zero address unchanged', async () => {
      const addr = await resolveUserAddress('0x0000000000000000000000000000000000000000');
      expect(addr).toBe('0x0000000000000000000000000000000000000000');
    });
  });

  describe('resolveUserAddress — input validation boundaries', () => {
    it('does NOT treat a 39-character hex as address (wrong length)', async () => {
      // 39 chars after 0x = invalid. Will fall through to username path, which
      // will attempt a subgraph query. We verify by catching the error.
      await expect(resolveUserAddress('0xC04C860454e73a9Ba524783aCbC7f7D6F5767eb')).rejects.toThrow();
    });

    it('does NOT treat a 41-character hex as address (too long)', async () => {
      await expect(resolveUserAddress('0xC04C860454e73a9Ba524783aCbC7f7D6F5767eb66')).rejects.toThrow();
    });

    it('rejects hex with non-hex characters (falls through to username)', async () => {
      // 0xZ..  — Z is not hex; treated as username, which will fail lookup
      await expect(resolveUserAddress('0xZ04C860454e73a9Ba524783aCbC7f7D6F5767eb6')).rejects.toThrow();
    });

    it('rejects address without 0x prefix', async () => {
      // No 0x = treated as username. Given no username matches a bare hex string, throws.
      await expect(resolveUserAddress('C04C860454e73a9Ba524783aCbC7f7D6F5767eb6')).rejects.toThrow();
    });
  });
});
