import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { listModuleStems, computeCoverage } from '../../src/commands/agent/test-coverage';

let tempRepo: string;

beforeEach(() => {
  tempRepo = mkdtempSync(join(tmpdir(), 'pop-test-cov-'));
  mkdirSync(join(tempRepo, 'src', 'lib'), { recursive: true });
  mkdirSync(join(tempRepo, 'test', 'lib'), { recursive: true });
});

afterEach(() => {
  if (existsSync(tempRepo)) {
    try { rmSync(tempRepo, { recursive: true, force: true }); } catch {}
  }
});

function seed(relPath: string, content = '// stub'): void {
  writeFileSync(join(tempRepo, relPath), content);
}

describe('agent test-coverage', () => {
  describe('listModuleStems', () => {
    it('returns sorted stems matching suffix', () => {
      seed('src/lib/alpha.ts');
      seed('src/lib/beta.ts');
      seed('src/lib/gamma.ts');
      const stems = listModuleStems(join(tempRepo, 'src', 'lib'), '.ts');
      expect(stems).toEqual(['alpha', 'beta', 'gamma']);
    });

    it('ignores files not matching suffix', () => {
      seed('src/lib/foo.ts');
      seed('src/lib/bar.json'); // wrong suffix
      seed('src/lib/baz.test.ts'); // counts — stem is "baz.test"
      const stems = listModuleStems(join(tempRepo, 'src', 'lib'), '.ts');
      expect(stems).toContain('foo');
      expect(stems).toContain('baz.test');
      expect(stems).not.toContain('bar');
    });

    it('returns [] for missing dir', () => {
      expect(listModuleStems(join(tempRepo, 'does', 'not', 'exist'), '.ts')).toEqual([]);
    });

    it('test suffix ".test.ts" strips correctly', () => {
      seed('test/lib/foo.test.ts');
      seed('test/lib/bar.test.ts');
      const stems = listModuleStems(join(tempRepo, 'test', 'lib'), '.test.ts');
      expect(stems).toEqual(['bar', 'foo']);
    });
  });

  describe('computeCoverage', () => {
    it('reports 100% when every module has a matching test', () => {
      seed('src/lib/a.ts');
      seed('src/lib/b.ts');
      seed('test/lib/a.test.ts');
      seed('test/lib/b.test.ts');
      const r = computeCoverage(tempRepo);
      expect(r.total).toBe(2);
      expect(r.tested).toBe(2);
      expect(r.untested).toBe(0);
      expect(r.coveragePct).toBe(100);
      expect(r.untestedModules).toEqual([]);
    });

    it('reports 0% when no modules have tests', () => {
      seed('src/lib/a.ts');
      seed('src/lib/b.ts');
      const r = computeCoverage(tempRepo);
      expect(r.total).toBe(2);
      expect(r.tested).toBe(0);
      expect(r.coveragePct).toBe(0);
      expect(r.untestedModules).toEqual(['a', 'b']);
    });

    it('partial coverage: mix of tested + untested', () => {
      seed('src/lib/a.ts');
      seed('src/lib/b.ts');
      seed('src/lib/c.ts');
      seed('src/lib/d.ts');
      seed('test/lib/a.test.ts');
      seed('test/lib/c.test.ts');
      const r = computeCoverage(tempRepo);
      expect(r.total).toBe(4);
      expect(r.tested).toBe(2);
      expect(r.coveragePct).toBe(50);
      expect(r.testedModules).toEqual(['a', 'c']);
      expect(r.untestedModules).toEqual(['b', 'd']);
    });

    it('orphan tests (test file without matching src) do NOT falsely credit coverage', () => {
      seed('src/lib/a.ts');
      seed('test/lib/a.test.ts');
      seed('test/lib/orphan.test.ts'); // tests something that doesn't exist in src/lib
      const r = computeCoverage(tempRepo);
      expect(r.total).toBe(1);
      expect(r.tested).toBe(1);
      expect(r.coveragePct).toBe(100);
    });

    it('handles empty src/lib (total=0, coveragePct=0, no NaN)', () => {
      const r = computeCoverage(tempRepo);
      expect(r.total).toBe(0);
      expect(r.coveragePct).toBe(0);
      expect(Number.isNaN(r.coveragePct)).toBe(false);
    });

    it('computes percentage to 1 decimal', () => {
      seed('src/lib/a.ts');
      seed('src/lib/b.ts');
      seed('src/lib/c.ts');
      seed('test/lib/a.test.ts');
      const r = computeCoverage(tempRepo);
      // 1 of 3 = 33.333... → rounded to 33.3
      expect(r.coveragePct).toBe(33.3);
    });

    it('returned untested list is sorted', () => {
      seed('src/lib/zeta.ts');
      seed('src/lib/alpha.ts');
      seed('src/lib/mu.ts');
      const r = computeCoverage(tempRepo);
      expect(r.untestedModules).toEqual(['alpha', 'mu', 'zeta']);
    });
  });
});
