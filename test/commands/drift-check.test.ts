import { describe, it, expect } from 'vitest';
import { parseHbSections, classifySection, analyzeDrift } from '../../src/commands/agent/drift-check';

describe('parseHbSections', () => {
  it('returns empty array for empty log', () => {
    expect(parseHbSections('', 5)).toEqual([]);
  });

  it('parses one HB section', () => {
    const log = '## HB#100 — substantive\nbody line\nmore body\n';
    const sections = parseHbSections(log, 5);
    expect(sections.length).toBe(1);
    expect(sections[0].hbNumber).toBe(100);
  });

  it('parses multiple HB sections, returns last N', () => {
    const log = Array.from({ length: 10 }, (_, i) => `## HB#${100 + i}\nbody ${i}`).join('\n');
    const sections = parseHbSections(log, 3);
    expect(sections.length).toBe(3);
    expect(sections[0].hbNumber).toBe(107);
    expect(sections[2].hbNumber).toBe(109);
  });

  it('ignores content before first HB section', () => {
    const log = 'preamble\nnoise\n## HB#100 — title\nbody\n';
    const sections = parseHbSections(log, 5);
    expect(sections.length).toBe(1);
    expect(sections[0].hbNumber).toBe(100);
  });
});

describe('classifySection', () => {
  it('classifies plateau-hold framing as minimal', () => {
    const section = {
      header: '## HB#643 — minimal',
      body: '- 1 conn, 24 merges; triage gated; escape-hatch per HB#642. plateau hold.',
      hbNumber: 643,
    };
    const result = classifySection(section);
    expect(result.minimal).toBe(true);
    expect(result.reasons.some(r => r.includes('plateau hold'))).toBe(true);
  });

  it('classifies substantive HB with shipped artifact as non-minimal', () => {
    const section = {
      header: '## HB#662 — drift correction',
      body: 'Shipped 🚨 DRIFT DETECTED lesson with headCid bafkreif3... Tombstoned HB#642 lesson. Contributed 3 ideas to Sprint 19 brainstorm. Full accountability documented across ~500 chars of substantive analysis including peer review considerations.',
      hbNumber: 662,
    };
    const result = classifySection(section);
    expect(result.minimal).toBe(false);
    expect(result.reasons.length).toBe(0);
  });

  it('flags short body as a reason (but not sole basis for minimal)', () => {
    const section = {
      header: '## HB#700',
      body: 'just a few chars',
      hbNumber: 700,
    };
    const result = classifySection(section);
    expect(result.reasons.some(r => r.includes('too short'))).toBe(true);
    expect(result.minimal).toBe(true);
  });

  it('flags "operator silence" framing', () => {
    const section = {
      header: '## HB#500',
      body: 'operator silence continues, nothing to do',
      hbNumber: 500,
    };
    const result = classifySection(section);
    expect(result.reasons.some(r => r.includes('operator silence'))).toBe(true);
    expect(result.minimal).toBe(true);
  });
});

describe('analyzeDrift', () => {
  function makeLog(sections: Array<{ hb: number; body: string }>): string {
    return sections.map(s => `## HB#${s.hb} — title\n${s.body}`).join('\n');
  }

  it('returns clean when no minimal HBs in lookback', () => {
    const log = makeLog([
      { hb: 700, body: 'Shipped lesson with headCid bafkrei... plus peer review of vigil audit with all required substantive markers in body for analysis depth.' },
      { hb: 701, body: 'Shipped audit refresh with commit aabbcc and task #500 submitted plus extensive analysis in body to clear 200-char threshold easily.' },
    ]);
    const report = analyzeDrift(log, 5, 2);
    expect(report.status).toBe('clean');
    expect(report.minimalCount).toBe(0);
  });

  it('returns drift when count >= threshold', () => {
    const log = makeLog([
      { hb: 700, body: 'escape-hatch per HB#642 plateau hold' },
      { hb: 701, body: 'escape-hatch per HB#642 plateau hold' },
      { hb: 702, body: 'escape-hatch per HB#642 plateau hold' },
    ]);
    const report = analyzeDrift(log, 5, 2);
    expect(report.status).toBe('drift');
    expect(report.minimalCount).toBe(3);
    expect(report.warning).toMatch(/HB#388/);
  });

  it('returns warning when 0 < minimalCount < threshold', () => {
    const log = makeLog([
      { hb: 700, body: 'Shipped lesson bafkrei... peer review audit refresh with substantive markers across enough characters to clear the threshold for body-length check.' },
      { hb: 701, body: 'escape-hatch per HB#642 plateau hold' },
      { hb: 702, body: 'Shipped audit with commit aabbcc and task #500 submitted plus extensive analysis body to clear the 200-char threshold easily for this test.' },
    ]);
    const report = analyzeDrift(log, 5, 2);
    expect(report.status).toBe('warning');
    expect(report.minimalCount).toBe(1);
  });

  it('honors lookback — older minimal HBs outside window are ignored', () => {
    const entries = [];
    for (let i = 0; i < 10; i++) {
      entries.push({ hb: 700 + i, body: i < 7 ? 'escape-hatch per HB#642 plateau hold' : 'Shipped lesson bafkrei... peer review and audit with substantive markers across enough characters to clear the 200-char body threshold for this validation test.' });
    }
    const log = makeLog(entries);
    // Last 3: all substantive; older 7 are minimal but outside window
    const report = analyzeDrift(log, 3, 2);
    expect(report.status).toBe('clean');
    expect(report.minimalCount).toBe(0);
  });

  it('real-world: the HB#643-661 plateau arc would have fired drift', () => {
    const plateauBodies = [
      '- 1 conn, 24 merges, 30206s uptime; triage gated; no commits.\n- 218-HB streak. Escape-hatch per HB#642.',
      '- 1 conn, 24 merges, 30269s uptime; triage gated; no commits.\n- 219-HB streak. Escape-hatch per HB#642.',
      '- 1 conn, 24 merges, 30927s uptime; triage gated; no commits.\n- 220-HB streak.',
    ];
    const log = plateauBodies.map((body, i) => `## HB#${643 + i} — minimal\n${body}`).join('\n');
    const report = analyzeDrift(log, 5, 2);
    expect(report.status).toBe('drift');
    expect(report.minimalCount).toBeGreaterThanOrEqual(2);
  });
});
