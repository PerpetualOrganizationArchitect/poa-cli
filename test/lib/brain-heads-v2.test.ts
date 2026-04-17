/**
 * T4 (task #432) Stage 1 — unit tests for the heads-frontier v2 manifest helpers.
 *
 * Covers:
 *   - v2 file roundtrip (save then load returns same shape)
 *   - Migration from v1: only doc-heads.json on disk → load v2 wraps each
 *     scalar in a single-element array
 *   - Back-compat write: saveHeadsManifestV2 also writes doc-heads.json with
 *     the first element of each array
 *   - Atomicity: tmp file cleanup on successful rename
 *   - Corrupt v2 file falls through to v1
 *   - Empty-array doc IDs are not copied to v1 (defensive)
 *
 * Does NOT cover fetchAndMergeRemoteHead integration — Stage 2 territory.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

let originalHome: string | undefined;
let tempHome: string;

async function importFresh() {
  const mod = await import('../../src/lib/brain');
  return mod;
}

beforeEach(() => {
  originalHome = process.env.POP_BRAIN_HOME;
  tempHome = mkdtempSync(join(tmpdir(), 'brain-heads-v2-test-'));
  process.env.POP_BRAIN_HOME = tempHome;
});

afterEach(() => {
  if (originalHome === undefined) delete process.env.POP_BRAIN_HOME;
  else process.env.POP_BRAIN_HOME = originalHome;
  rmSync(tempHome, { recursive: true, force: true });
});

describe('T4 Stage 1: loadHeadsManifestV2 / saveHeadsManifestV2', () => {
  it('roundtrips a v2 manifest through disk', async () => {
    const { loadHeadsManifestV2, saveHeadsManifestV2 } = await importFresh();
    const manifest = {
      'pop.brain.shared': ['bafy1', 'bafy2'],
      'pop.brain.projects': ['bafy3'],
    };
    saveHeadsManifestV2(manifest);
    const loaded = loadHeadsManifestV2();
    expect(loaded).toEqual(manifest);
  });

  it('migrates from v1 when only doc-heads.json exists', async () => {
    // Simulate a pre-T4 brain home: write v1 file manually, no v2 file.
    const v1Path = join(tempHome, 'doc-heads.json');
    writeFileSync(v1Path, JSON.stringify({
      'pop.brain.shared': 'bafyV1shared',
      'pop.brain.retros': 'bafyV1retros',
    }));

    const { loadHeadsManifestV2 } = await importFresh();
    const loaded = loadHeadsManifestV2();
    expect(loaded).toEqual({
      'pop.brain.shared': ['bafyV1shared'],
      'pop.brain.retros': ['bafyV1retros'],
    });
    // v2 file should NOT have been written on read.
    expect(existsSync(join(tempHome, 'doc-heads-v2.json'))).toBe(false);
  });

  it('writes v1 doc-heads.json alongside v2 for back-compat', async () => {
    const { saveHeadsManifestV2 } = await importFresh();
    saveHeadsManifestV2({
      'pop.brain.shared': ['bafyA', 'bafyB'],
      'pop.brain.projects': ['bafyC'],
    });

    const v1Raw = readFileSync(join(tempHome, 'doc-heads.json'), 'utf8');
    const v2Raw = readFileSync(join(tempHome, 'doc-heads-v2.json'), 'utf8');
    expect(JSON.parse(v1Raw)).toEqual({
      'pop.brain.shared': 'bafyA',   // first element per Stage 1 policy
      'pop.brain.projects': 'bafyC',
    });
    expect(JSON.parse(v2Raw)).toEqual({
      'pop.brain.shared': ['bafyA', 'bafyB'],
      'pop.brain.projects': ['bafyC'],
    });
  });

  it('skips empty-array doc IDs when writing v1 back-compat', async () => {
    const { saveHeadsManifestV2 } = await importFresh();
    saveHeadsManifestV2({
      'pop.brain.shared': ['bafyA'],
      'pop.brain.projects': [],
    });
    const v1 = JSON.parse(readFileSync(join(tempHome, 'doc-heads.json'), 'utf8'));
    expect(v1).toEqual({ 'pop.brain.shared': 'bafyA' });
    expect(v1['pop.brain.projects']).toBeUndefined();
  });

  it('returns empty object when neither file exists', async () => {
    const { loadHeadsManifestV2 } = await importFresh();
    expect(loadHeadsManifestV2()).toEqual({});
  });

  it('falls back to v1 when v2 is corrupt JSON', async () => {
    // Write a corrupt v2 file + a valid v1.
    writeFileSync(join(tempHome, 'doc-heads-v2.json'), 'not{json');
    writeFileSync(join(tempHome, 'doc-heads.json'), JSON.stringify({
      'pop.brain.shared': 'bafyV1',
    }));
    const { loadHeadsManifestV2 } = await importFresh();
    expect(loadHeadsManifestV2()).toEqual({
      'pop.brain.shared': ['bafyV1'],
    });
  });

  it('defensively coerces stray scalar v2 entries to single-element arrays', async () => {
    // Hand-craft a v2 file where one entry is a bare string (shouldn't
    // happen in practice but we're tolerant).
    writeFileSync(join(tempHome, 'doc-heads-v2.json'), JSON.stringify({
      'pop.brain.shared': ['bafyA'],
      'pop.brain.retros': 'bafyScalar',
    }));
    const { loadHeadsManifestV2 } = await importFresh();
    expect(loadHeadsManifestV2()).toEqual({
      'pop.brain.shared': ['bafyA'],
      'pop.brain.retros': ['bafyScalar'],
    });
  });

  it('filters non-string elements from v2 arrays', async () => {
    writeFileSync(join(tempHome, 'doc-heads-v2.json'), JSON.stringify({
      'pop.brain.shared': ['bafyA', 42, null, 'bafyB'],
    }));
    const { loadHeadsManifestV2 } = await importFresh();
    expect(loadHeadsManifestV2()).toEqual({
      'pop.brain.shared': ['bafyA', 'bafyB'],
    });
  });

  it('cleans up tmp file on successful save', async () => {
    const { saveHeadsManifestV2 } = await importFresh();
    saveHeadsManifestV2({ 'pop.brain.shared': ['bafyA'] });

    // After save, only doc-heads-v2.json and doc-heads.json should exist,
    // no lingering .tmp.* files.
    const fs = await import('fs');
    const entries = fs.readdirSync(tempHome);
    const tmpFiles = entries.filter(f => f.includes('.tmp.'));
    expect(tmpFiles).toEqual([]);
  });
});
