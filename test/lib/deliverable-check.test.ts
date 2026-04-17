import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execFileSync } from 'child_process';
import { extractReferencedPaths, checkDeliverables, formatBlockMessage } from '../../src/lib/deliverable-check';

describe('extractReferencedPaths', () => {
  it('extracts simple paths', () => {
    expect(extractReferencedPaths('see src/lib/foo.ts for details')).toEqual(['src/lib/foo.ts']);
  });
  it('extracts multiple distinct paths', () => {
    const txt = 'updated src/lib/a.ts and test/b.test.ts plus docs/c.md';
    expect(new Set(extractReferencedPaths(txt))).toEqual(
      new Set(['src/lib/a.ts', 'test/b.test.ts', 'docs/c.md']),
    );
  });
  it('deduplicates repeated paths', () => {
    expect(extractReferencedPaths('src/x.ts and src/x.ts again')).toEqual(['src/x.ts']);
  });
  it('handles deep paths', () => {
    expect(extractReferencedPaths('see .claude/skills/foo/SKILL.md')).toContain('.claude/skills/foo/SKILL.md');
  });
  it('ignores bare filenames (no slash)', () => {
    expect(extractReferencedPaths('updated README.md and CHANGELOG.md')).toEqual([]);
  });
  it('ignores URLs', () => {
    expect(extractReferencedPaths('see https://example.com/path/to.html for refs')).toEqual([]);
  });
  it('ignores ipfs URIs', () => {
    expect(extractReferencedPaths('pinned at ipfs://Qmfoo/bar.json')).toEqual([]);
  });
  it('ignores tx hash chunks', () => {
    expect(extractReferencedPaths('tx 0xb1bbce885b2e71bb48587f2e1559f019ea6bd69e')).toEqual([]);
  });
  it('ignores raw IPFS CIDs that look path-shaped', () => {
    const txt = 'CID QmZkxRNVDojgMQyW86hVUYPhhz3PEVEk4khjZoMKiktkZD/sub.json';
    const out = extractReferencedPaths(txt);
    // The Qm... part should be filtered; sub.json alone has no slash so won't match anyway
    expect(out.filter((p) => p.startsWith('Qm'))).toEqual([]);
  });
  it('returns empty for prose with no paths', () => {
    expect(extractReferencedPaths('Just a prose paragraph with no file references at all.')).toEqual([]);
  });
  it('handles multi-line submissions', () => {
    const txt = `DELIVERABLES:
- src/lib/foo.ts (new, 100 lines)
- test/lib/foo.test.ts (new, 50 lines)
- agent/artifacts/research/notes.md (updated)
TX: 0xabc...`;
    expect(new Set(extractReferencedPaths(txt))).toEqual(
      new Set(['src/lib/foo.ts', 'test/lib/foo.test.ts', 'agent/artifacts/research/notes.md']),
    );
  });
});

describe('checkDeliverables', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'pop-deliv-check-test-'));
    execFileSync('git', ['init', '-q'], { cwd: tempDir, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: tempDir, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.name', 'test'], { cwd: tempDir, stdio: 'ignore' });
  });

  afterEach(() => {
    try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
  });

  function tWrite(rel: string, contents: string) {
    const abs = join(tempDir, rel);
    mkdirSync(join(tempDir, rel.split('/').slice(0, -1).join('/') || '.'), { recursive: true });
    writeFileSync(abs, contents);
  }
  function tGit(...args: string[]) {
    execFileSync('git', args, { cwd: tempDir, stdio: 'ignore' });
  }

  it('returns empty result for empty paths', () => {
    const r = checkDeliverables([], tempDir);
    expect(r.committed).toEqual([]);
    expect(r.uncommitted).toEqual([]);
    expect(r.untracked).toEqual([]);
    expect(r.nonexistent).toEqual([]);
  });

  it('classifies committed file as committed', () => {
    tWrite('src/a.ts', 'const a = 1;\n');
    tGit('add', 'src/a.ts');
    tGit('commit', '-m', 'add a');
    const r = checkDeliverables(['src/a.ts'], tempDir);
    expect(r.committed).toEqual(['src/a.ts']);
    expect(r.uncommitted).toEqual([]);
    expect(r.untracked).toEqual([]);
  });

  it('classifies tracked-but-modified file as uncommitted', () => {
    tWrite('src/b.ts', 'const b = 1;\n');
    tGit('add', 'src/b.ts');
    tGit('commit', '-m', 'add b');
    tWrite('src/b.ts', 'const b = 2;\n');
    const r = checkDeliverables(['src/b.ts'], tempDir);
    expect(r.uncommitted).toEqual(['src/b.ts']);
    expect(r.committed).toEqual([]);
  });

  it('classifies on-disk-but-untracked file as untracked', () => {
    // git ls-files returns empty for an empty repo. Create one committed file
    // first so the lsFiles set has at least one entry — otherwise the
    // 'git not present / empty repo' soft-fail path triggers.
    tWrite('src/seed.ts', 'seed');
    tGit('add', 'src/seed.ts');
    tGit('commit', '-m', 'seed');
    tWrite('src/c.ts', 'const c = 1;\n');
    const r = checkDeliverables(['src/c.ts'], tempDir);
    expect(r.untracked).toEqual(['src/c.ts']);
    expect(r.committed).toEqual([]);
  });

  it('classifies missing path as nonexistent', () => {
    tWrite('src/seed.ts', 'seed');
    tGit('add', 'src/seed.ts');
    tGit('commit', '-m', 'seed');
    const r = checkDeliverables(['src/never-existed.ts'], tempDir);
    expect(r.nonexistent).toEqual(['src/never-existed.ts']);
    expect(r.uncommitted).toEqual([]);
    expect(r.untracked).toEqual([]);
  });

  it('handles mixed states correctly', () => {
    tWrite('src/committed.ts', 'x');
    tGit('add', 'src/committed.ts');
    tGit('commit', '-m', 'add');
    tWrite('src/dirty.ts', 'y');
    tGit('add', 'src/dirty.ts');
    tGit('commit', '-m', 'add dirty');
    tWrite('src/dirty.ts', 'y2');
    tWrite('src/untracked.ts', 'z');
    const r = checkDeliverables(['src/committed.ts', 'src/dirty.ts', 'src/untracked.ts', 'src/nope.ts'], tempDir);
    expect(r.committed).toEqual(['src/committed.ts']);
    expect(r.uncommitted).toEqual(['src/dirty.ts']);
    expect(r.untracked).toEqual(['src/untracked.ts']);
    expect(r.nonexistent).toEqual(['src/nope.ts']);
  });
});

describe('formatBlockMessage', () => {
  it('returns null when nothing to block', () => {
    expect(formatBlockMessage({ committed: ['ok.ts'], uncommitted: [], untracked: [], nonexistent: [] })).toBeNull();
  });
  it('formats untracked + uncommitted into block message', () => {
    const msg = formatBlockMessage({
      committed: [], uncommitted: ['src/a.ts'], untracked: ['src/b.ts'], nonexistent: [],
    });
    expect(msg).not.toBeNull();
    expect(msg).toContain('Submission blocked');
    expect(msg).toContain('src/a.ts');
    expect(msg).toContain('src/b.ts');
    expect(msg).toContain('git add');
    expect(msg).toContain('--allow-uncommitted');
  });
  it('does NOT block on committed-only', () => {
    expect(formatBlockMessage({ committed: ['x.ts', 'y.ts'], uncommitted: [], untracked: [], nonexistent: ['z.ts'] })).toBeNull();
  });
});
