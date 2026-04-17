import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  markNoAllocation,
  hasKnownNoAllocation,
  getNoAllocationSet,
  getNoAllocCachePath,
} from '../../src/lib/no-alloc-cache';

let tempHome: string;
let originalBrainHome: string | undefined;

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), 'pop-no-alloc-test-'));
  originalBrainHome = process.env.POP_BRAIN_HOME;
  process.env.POP_BRAIN_HOME = tempHome;
});

afterEach(() => {
  if (existsSync(tempHome)) {
    try { rmSync(tempHome, { recursive: true, force: true }); } catch {}
  }
  if (originalBrainHome === undefined) delete process.env.POP_BRAIN_HOME;
  else process.env.POP_BRAIN_HOME = originalBrainHome;
});

describe('no-alloc-cache', () => {
  describe('getNoAllocCachePath', () => {
    it('uses POP_BRAIN_HOME when set', () => {
      const path = getNoAllocCachePath();
      expect(path.startsWith(tempHome)).toBe(true);
      expect(path.endsWith('Memory/no-alloc-cache.json')).toBe(true);
    });
  });

  describe('markNoAllocation + hasKnownNoAllocation', () => {
    it('round-trips a single entry', () => {
      expect(hasKnownNoAllocation('0xABC', 'orgA', 'dist1')).toBe(false);
      markNoAllocation('0xABC', 'orgA', 'dist1');
      expect(hasKnownNoAllocation('0xABC', 'orgA', 'dist1')).toBe(true);
    });

    it('returns false for unmarked (address, orgId, distId) triples', () => {
      markNoAllocation('0xABC', 'orgA', 'dist1');
      expect(hasKnownNoAllocation('0xDEF', 'orgA', 'dist1')).toBe(false);
      expect(hasKnownNoAllocation('0xABC', 'orgB', 'dist1')).toBe(false);
      expect(hasKnownNoAllocation('0xABC', 'orgA', 'dist2')).toBe(false);
    });

    it('lower-cases address AND orgId (but preserves distributionId case)', () => {
      // orgId is lower-cased in the cache key but distId is NOT — this is the
      // implementation behavior captured as a test so a refactor would surface.
      markNoAllocation('0xAbC', 'OrgA', 'Dist1');
      expect(hasKnownNoAllocation('0xabc', 'orga', 'Dist1')).toBe(true);
      expect(hasKnownNoAllocation('0xABC', 'ORGA', 'Dist1')).toBe(true);
      // distId is case-sensitive
      expect(hasKnownNoAllocation('0xabc', 'orga', 'dist1')).toBe(false);
    });

    it('supports multiple distributions per address', () => {
      markNoAllocation('0xABC', 'orgA', 'dist1');
      markNoAllocation('0xABC', 'orgA', 'dist2');
      markNoAllocation('0xABC', 'orgB', 'dist9');
      expect(hasKnownNoAllocation('0xABC', 'orgA', 'dist1')).toBe(true);
      expect(hasKnownNoAllocation('0xABC', 'orgA', 'dist2')).toBe(true);
      expect(hasKnownNoAllocation('0xABC', 'orgB', 'dist9')).toBe(true);
    });

    it('persists across reads (loaded from disk)', () => {
      markNoAllocation('0xABC', 'orgA', 'dist1');
      const path = getNoAllocCachePath();
      expect(existsSync(path)).toBe(true);
      const raw = JSON.parse(readFileSync(path, 'utf8'));
      expect(raw['0xabc']['orga-dist1']).toBeGreaterThan(0);
    });
  });

  describe('getNoAllocationSet', () => {
    it('returns empty Set when address has no entries', () => {
      const set = getNoAllocationSet('0xABC');
      expect(set.size).toBe(0);
    });

    it('returns all "orgId-distId" keys for an address', () => {
      markNoAllocation('0xABC', 'orgA', 'dist1');
      markNoAllocation('0xABC', 'orgA', 'dist2');
      markNoAllocation('0xABC', 'orgB', 'dist9');
      // Other address — must not appear in 0xABC's set
      markNoAllocation('0xDEF', 'orgA', 'dist1');
      const set = getNoAllocationSet('0xABC');
      expect(set.size).toBe(3);
      expect(set.has('orga-dist1')).toBe(true);
      expect(set.has('orga-dist2')).toBe(true);
      expect(set.has('orgb-dist9')).toBe(true);
      expect(set.has('orga-dist1')).toBe(true);
    });

    it('is case-insensitive on address lookup', () => {
      markNoAllocation('0xABC', 'orgA', 'dist1');
      expect(getNoAllocationSet('0xabc').has('orga-dist1')).toBe(true);
      expect(getNoAllocationSet('0xABC').has('orga-dist1')).toBe(true);
    });
  });

  describe('persistence edge cases', () => {
    it('ignores corrupt cache file and returns empty', () => {
      const path = getNoAllocCachePath();
      // Create parent dir + write corrupt JSON
      markNoAllocation('0xABC', 'orgA', 'dist1'); // creates dir + valid file
      require('fs').writeFileSync(path, 'this is not json{]');
      expect(hasKnownNoAllocation('0xABC', 'orgA', 'dist1')).toBe(false);
      expect(getNoAllocationSet('0xABC').size).toBe(0);
    });
  });
});
