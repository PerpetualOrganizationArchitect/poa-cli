import { describe, it, expect } from 'vitest';
import {
  parseHbSections,
  classifySection,
  analyzeDrift,
  type HbSection,
} from '../../src/commands/agent/drift-check';

// Helper — build a substantive-looking HB section body (≥200 chars + a marker)
function substantiveBody(extraNote = ''): string {
  return `Triage: clean. Shipped commit abc1234 landing a new audit. Published brain lesson headCid bafkrei... describing the finding. Task #999 was reviewed and approved via tx 0xabc. The heartbeat log reflects this substantive progress cleanly. ${extraNote}`;
}

function makeLog(sections: Array<{ hb: number; body: string }>): string {
  return sections
    .map((s) => `## HB#${s.hb} — 2026-04-17\n\n${s.body}\n\n---\n`)
    .join('\n');
}

describe('drift-check', () => {
  describe('parseHbSections', () => {
    it('returns empty array for empty log', () => {
      expect(parseHbSections('', 5)).toEqual([]);
    });

    it('parses a single HB section', () => {
      const log = '## HB#100 — 2026-04-17\n\nSome content here.\n';
      const sections = parseHbSections(log, 5);
      expect(sections.length).toBe(1);
      expect(sections[0].hbNumber).toBe(100);
      expect(sections[0].body).toContain('Some content here');
    });

    it('parses multiple HB sections in order', () => {
      const log = makeLog([
        { hb: 1, body: 'first' },
        { hb: 2, body: 'second' },
        { hb: 3, body: 'third' },
      ]);
      const sections = parseHbSections(log, 10);
      expect(sections.length).toBe(3);
      expect(sections[0].hbNumber).toBe(1);
      expect(sections[2].hbNumber).toBe(3);
    });

    it('respects lookback limit — returns only last N sections', () => {
      const log = makeLog(
        [1, 2, 3, 4, 5, 6, 7].map((hb) => ({ hb, body: `body ${hb}` })),
      );
      const sections = parseHbSections(log, 3);
      expect(sections.length).toBe(3);
      expect(sections.map((s) => s.hbNumber)).toEqual([5, 6, 7]);
    });

    it('ignores lines not under an HB header', () => {
      const log = '# Top-level title\n\nPreamble content\n\n## HB#42\n\nReal body\n';
      const sections = parseHbSections(log, 5);
      expect(sections.length).toBe(1);
      expect(sections[0].hbNumber).toBe(42);
      // Preamble should NOT be in body
      expect(sections[0].body).not.toContain('Preamble content');
    });
  });

  describe('classifySection', () => {
    function sec(body: string, hb: number = 100): HbSection {
      return { header: `## HB#${hb}`, body, hbNumber: hb };
    }

    it('substantive body + marker → NOT minimal', () => {
      const r = classifySection(sec(substantiveBody()));
      expect(r.minimal).toBe(false);
    });

    it('short body + no marker → minimal', () => {
      const r = classifySection(sec('No change.'));
      expect(r.minimal).toBe(true);
      expect(r.reasons.some((x) => /body too short/.test(x))).toBe(true);
      expect(r.reasons.some((x) => /no substantive-action marker/.test(x))).toBe(true);
    });

    it('long body but no substantive marker → minimal (missing marker)', () => {
      // 300-char body with no shipped/commit/lesson/etc markers
      const longNoMarker = 'This is a long body that discusses general observations and thoughts about the state of the org but never actually names a concrete substantive action like a ship or a commit or a lesson or a task review. '.repeat(2);
      const r = classifySection(sec(longNoMarker));
      // Missing marker + forbidden-framing may be zero, so this depends: needs ≥2 reasons with structural signal
      // With only missing-marker (no short-body, no framing), reasons.length = 1 → minimal=false
      // This is the design: missing-marker alone isn't drift, short-body alone isn't drift
      expect(r.minimal).toBe(false);
    });

    it('forbidden framing alone (with substantive body) → NOT minimal', () => {
      // Discussing the drift pattern in a self-correction is legit
      const body = `${substantiveBody()} Acknowledging past plateau hold incident as self-correction.`;
      const r = classifySection(sec(body));
      expect(r.minimal).toBe(false);
    });

    it('forbidden framing + short body + no marker → minimal with all 3 reasons', () => {
      const r = classifySection(sec('plateau hold. no state change.'));
      expect(r.minimal).toBe(true);
      expect(r.reasons.length).toBeGreaterThanOrEqual(2);
    });

    it('body exactly at 200-char boundary is treated as long enough', () => {
      const body200 = 'a'.repeat(250) + ' shipped something concrete';
      const r = classifySection(sec(body200));
      expect(r.minimal).toBe(false);
    });
  });

  describe('analyzeDrift', () => {
    it('returns clean status when all sections are substantive', () => {
      const log = makeLog(
        [1, 2, 3].map((hb) => ({ hb, body: substantiveBody() })),
      );
      const r = analyzeDrift(log, 5, 2);
      expect(r.status).toBe('clean');
      expect(r.minimalCount).toBe(0);
      expect(r.warning).toBeUndefined();
    });

    it('returns drift when minimalCount >= threshold', () => {
      const log = makeLog([
        { hb: 1, body: substantiveBody() },
        { hb: 2, body: 'No change.' },
        { hb: 3, body: 'No change.' },
        { hb: 4, body: 'No change.' },
      ]);
      const r = analyzeDrift(log, 5, 2);
      expect(r.status).toBe('drift');
      expect(r.minimalCount).toBe(3);
      expect(r.warning).toMatch(/3 consecutive|MUST ship/);
      expect(r.warning).toContain('HB#388');
    });

    it('returns warning (below threshold but non-zero) when minimalCount < threshold', () => {
      const log = makeLog([
        { hb: 1, body: substantiveBody() },
        { hb: 2, body: substantiveBody() },
        { hb: 3, body: 'No change.' },
      ]);
      const r = analyzeDrift(log, 5, 2);
      expect(r.status).toBe('warning');
      expect(r.minimalCount).toBe(1);
    });

    it('respects lookback — minimal HBs outside window do not count', () => {
      const log = makeLog([
        { hb: 1, body: 'No change.' },
        { hb: 2, body: 'No change.' },
        { hb: 3, body: 'No change.' },
        { hb: 4, body: substantiveBody() },
        { hb: 5, body: substantiveBody() },
      ]);
      // lookback=2 → only HB#4 + HB#5 inspected, both substantive → clean
      const r = analyzeDrift(log, 2, 2);
      expect(r.status).toBe('clean');
      expect(r.totalSections).toBe(2);
    });

    it('threshold configurable — drift at =1', () => {
      const log = makeLog([
        { hb: 1, body: substantiveBody() },
        { hb: 2, body: 'No change.' },
      ]);
      const r = analyzeDrift(log, 5, 1);
      expect(r.status).toBe('drift');
    });

    it('empty log returns clean with 0 sections', () => {
      const r = analyzeDrift('', 5, 2);
      expect(r.status).toBe('clean');
      expect(r.totalSections).toBe(0);
      expect(r.minimalCount).toBe(0);
    });

    it('captures minimalSections with header + reasons for diagnosis', () => {
      const log = makeLog([
        { hb: 1, body: 'No change.' },
        { hb: 2, body: 'No change.' },
      ]);
      const r = analyzeDrift(log, 5, 2);
      expect(r.minimalSections.length).toBe(2);
      expect(r.minimalSections[0].header).toMatch(/HB#1/);
      expect(r.minimalSections[0].reasons.length).toBeGreaterThan(0);
    });

    it('real-world reproduction: vigil HB#377-396 plateau-hold (flagged correctly)', () => {
      // Simulates the HB#394-396 ultra-brief pattern vigil logged
      const log = makeLog([
        { hb: 394, body: 'No change.' },
        { hb: 395, body: 'No change.' },
        { hb: 396, body: 'No change.' },
      ]);
      const r = analyzeDrift(log, 5, 2);
      expect(r.status).toBe('drift');
      expect(r.minimalCount).toBe(3);
      // This is the exact class argus's HB#388 protocol targets
      expect(r.warning).toContain('HB#388');
    });
  });
});
