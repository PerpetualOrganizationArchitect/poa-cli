import { describe, it, expect } from 'vitest';
import { validateBrainDocShape } from '../../src/lib/brain-schemas';

describe('validateBrainDocShape — pop.brain.shared', () => {
  it('accepts a canonical lesson', () => {
    const doc = {
      lessons: [
        {
          id: 'test-1',
          author: '0xabc',
          title: 'Canonical lesson',
          body: 'Body content here.',
          timestamp: 1776183000,
        },
      ],
    };
    const result = validateBrainDocShape('pop.brain.shared', doc);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('accepts legacy lessons with text/ts synonyms', () => {
    const doc = {
      lessons: [
        { id: 'legacy-1', text: 'Old shape body', ts: 1776000000, author: '0xabc' },
      ],
    };
    const result = validateBrainDocShape('pop.brain.shared', doc);
    expect(result.ok).toBe(true);
  });

  it('rejects a lesson missing body and text', () => {
    const doc = {
      lessons: [{ id: 'bad-1', title: 'No body', author: '0xabc' }],
    };
    const result = validateBrainDocShape('pop.brain.shared', doc);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('body/text'))).toBe(true);
  });

  it('rejects a lesson missing both title and id', () => {
    const doc = {
      lessons: [{ body: 'Body only, no identifier', author: '0xabc' }],
    };
    const result = validateBrainDocShape('pop.brain.shared', doc);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('title/id'))).toBe(true);
  });

  it('rejects an empty-string body', () => {
    const doc = {
      lessons: [{ id: 'bad-2', title: 'Empty body', body: '', author: '0xabc' }],
    };
    const result = validateBrainDocShape('pop.brain.shared', doc);
    expect(result.ok).toBe(false);
  });

  it('accepts a doc with no lessons array (bootstrap case)', () => {
    const result = validateBrainDocShape('pop.brain.shared', {});
    expect(result.ok).toBe(true);
  });
});

describe('validateBrainDocShape — pop.brain.projects', () => {
  it('accepts a canonical project', () => {
    const doc = {
      projects: [
        { id: 'proj-1', name: 'My Project', stage: 'propose', proposedBy: '0xabc' },
      ],
    };
    const result = validateBrainDocShape('pop.brain.projects', doc);
    expect(result.ok).toBe(true);
  });

  it('accepts all canonical lifecycle stages', () => {
    for (const stage of ['propose', 'discuss', 'plan', 'vote', 'execute', 'review', 'ship']) {
      const doc = { projects: [{ id: 'p', name: 'n', stage }] };
      const result = validateBrainDocShape('pop.brain.projects', doc);
      expect(result.ok).toBe(true);
    }
  });

  it('rejects a project with an invalid stage', () => {
    const doc = {
      projects: [{ id: 'proj-1', name: 'Bad', stage: 'not-a-real-stage' }],
    };
    const result = validateBrainDocShape('pop.brain.projects', doc);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('stage'))).toBe(true);
  });

  it('rejects a project missing id', () => {
    const doc = {
      projects: [{ name: 'No id', stage: 'propose' }],
    };
    const result = validateBrainDocShape('pop.brain.projects', doc);
    expect(result.ok).toBe(false);
  });
});

describe('validateBrainDocShape — unknown doc ids', () => {
  it('accepts unknown doc ids with a warning', () => {
    const result = validateBrainDocShape('pop.brain.experimental', { anything: 42 });
    expect(result.ok).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
