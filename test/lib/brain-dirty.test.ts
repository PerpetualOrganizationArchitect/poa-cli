/**
 * T2 (task #430) — unit tests for the doc-dirty-bit helpers.
 *
 * Covers:
 *   - load/save roundtrip through the manifest file
 *   - markDocDirty idempotency (double-mark updates in place)
 *   - clearDocDirty with matching CID clears
 *   - clearDocDirty with mismatched CID DOES NOT clear (race-protection)
 *   - clearDocDirty with no CID force-clears
 *
 * Does NOT cover the fetch-path integration (markDocDirty fires on
 * bitswap failure, clearDocDirty fires on adopt/merge success). Those
 * code paths are exercised by the live 2-daemon scenario the daemon
 * repair worker runs against in production.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// The helpers read $POP_BRAIN_HOME for the manifest path. Redirect that
// to a per-test temp dir so tests don't touch the real brain home.
let originalHome: string | undefined;
let tempHome: string;

async function importFresh() {
  // vi's module cache would re-use the same closure if we imported at
  // top-level. Use dynamic import so each test suite can rebind the env.
  const mod = await import('../../src/lib/brain');
  return mod;
}

describe('doc-dirty helpers (T2 / task #430)', () => {
  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), 'pop-brain-dirty-test-'));
    originalHome = process.env.POP_BRAIN_HOME;
    process.env.POP_BRAIN_HOME = tempHome;
  });

  afterEach(() => {
    if (originalHome === undefined) {
      delete process.env.POP_BRAIN_HOME;
    } else {
      process.env.POP_BRAIN_HOME = originalHome;
    }
    try {
      rmSync(tempHome, { recursive: true, force: true });
    } catch {}
  });

  it('loadDocDirty returns {} when manifest does not exist', async () => {
    const { loadDocDirty } = await importFresh();
    expect(loadDocDirty()).toEqual({});
  });

  it('markDocDirty persists to disk; loadDocDirty reads it back', async () => {
    const { markDocDirty, loadDocDirty } = await importFresh();
    markDocDirty('pop.brain.shared', 'bafkreibogus1', 'bitswap: timeout');
    const loaded = loadDocDirty();
    expect(Object.keys(loaded)).toEqual(['pop.brain.shared']);
    expect(loaded['pop.brain.shared'].cid).toBe('bafkreibogus1');
    expect(loaded['pop.brain.shared'].lastError).toBe('bitswap: timeout');
    expect(loaded['pop.brain.shared'].dirtyAt).toBeGreaterThan(0);
    // And confirm the file was actually written.
    const path = join(tempHome, 'doc-dirty.json');
    expect(existsSync(path)).toBe(true);
  });

  it('markDocDirty is idempotent — second call updates in place', async () => {
    const { markDocDirty, loadDocDirty } = await importFresh();
    markDocDirty('pop.brain.shared', 'bafkreibogus1', 'err1');
    const first = loadDocDirty()['pop.brain.shared'];
    // Sleep 10ms so the timestamp differs and we can tell the update fired.
    await new Promise(r => setTimeout(r, 10));
    markDocDirty('pop.brain.shared', 'bafkreibogus2', 'err2');
    const second = loadDocDirty()['pop.brain.shared'];
    expect(second.cid).toBe('bafkreibogus2');
    expect(second.lastError).toBe('err2');
    expect(second.dirtyAt).toBeGreaterThanOrEqual(first.dirtyAt);
    // Only one entry still — idempotent, not additive.
    expect(Object.keys(loadDocDirty())).toHaveLength(1);
  });

  it('clearDocDirty with matching cid removes the entry', async () => {
    const { markDocDirty, clearDocDirty, loadDocDirty } = await importFresh();
    markDocDirty('pop.brain.shared', 'bafkreibogus1', 'err');
    clearDocDirty('pop.brain.shared', 'bafkreibogus1');
    expect(loadDocDirty()).toEqual({});
  });

  it('clearDocDirty with MISMATCHED cid preserves the entry (race protection)', async () => {
    const { markDocDirty, clearDocDirty, loadDocDirty } = await importFresh();
    // Scenario: doc X was marked dirty for CID A. Some other code path
    // already successfully merged CID B (a newer head). The mismatched
    // clear should NOT remove the A-specific dirty entry — A still
    // deserves a retry.
    markDocDirty('pop.brain.shared', 'bafkreiCID_A', 'err');
    clearDocDirty('pop.brain.shared', 'bafkreiCID_B');
    const after = loadDocDirty();
    expect(after['pop.brain.shared']?.cid).toBe('bafkreiCID_A');
  });

  it('clearDocDirty with no cid argument force-clears', async () => {
    const { markDocDirty, clearDocDirty, loadDocDirty } = await importFresh();
    markDocDirty('pop.brain.shared', 'bafkreiCID_A', 'err');
    clearDocDirty('pop.brain.shared');
    expect(loadDocDirty()).toEqual({});
  });

  it('clearDocDirty on unknown docId is a no-op, not an error', async () => {
    const { clearDocDirty, loadDocDirty } = await importFresh();
    expect(() => clearDocDirty('pop.brain.shared', 'bafkreiAny')).not.toThrow();
    expect(loadDocDirty()).toEqual({});
  });

  it('multiple docs can be dirty simultaneously and are cleared independently', async () => {
    const { markDocDirty, clearDocDirty, loadDocDirty } = await importFresh();
    markDocDirty('pop.brain.shared', 'cid1', 'e1');
    markDocDirty('pop.brain.projects', 'cid2', 'e2');
    markDocDirty('pop.brain.retros', 'cid3', 'e3');
    expect(Object.keys(loadDocDirty())).toHaveLength(3);
    clearDocDirty('pop.brain.projects', 'cid2');
    const after = loadDocDirty();
    expect(Object.keys(after).sort()).toEqual(['pop.brain.retros', 'pop.brain.shared']);
  });

  it('manifest file survives read by another caller (atomic write)', async () => {
    const { markDocDirty } = await importFresh();
    markDocDirty('pop.brain.shared', 'cid', 'err');
    const path = join(tempHome, 'doc-dirty.json');
    // Parse directly from disk — if the write were non-atomic, a
    // concurrent reader might see a half-written file. We just verify
    // the final state parses cleanly as JSON.
    const raw = readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw);
    expect(parsed['pop.brain.shared'].cid).toBe('cid');
  });
});
