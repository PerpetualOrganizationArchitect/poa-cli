import { describe, it, expect } from 'vitest';
import {
  AUDIT_DB,
  architectureClass,
  type AuditEntry,
} from '../../src/lib/audit-db';

describe('AUDIT_DB', () => {
  it('is non-empty', () => {
    expect(Object.keys(AUDIT_DB).length).toBeGreaterThan(0);
  });

  it('every entry has the full shape', () => {
    for (const [name, entry] of Object.entries(AUDIT_DB)) {
      expect(typeof entry.grade, `${name}.grade`).toBe('string');
      expect(typeof entry.score, `${name}.score`).toBe('number');
      expect(typeof entry.gini, `${name}.gini`).toBe('number');
      expect(typeof entry.category, `${name}.category`).toBe('string');
      expect(typeof entry.platform, `${name}.platform`).toBe('string');
      if (entry.voters !== undefined) {
        expect(typeof entry.voters, `${name}.voters`).toBe('number');
      }
    }
  });

  it('all Gini values are in [0, 1]', () => {
    for (const [name, entry] of Object.entries(AUDIT_DB)) {
      expect(entry.gini, `${name}.gini`).toBeGreaterThanOrEqual(0);
      expect(entry.gini, `${name}.gini`).toBeLessThanOrEqual(1);
    }
  });

  it('all score values are in [0, 100]', () => {
    for (const [name, entry] of Object.entries(AUDIT_DB)) {
      expect(entry.score, `${name}.score`).toBeGreaterThanOrEqual(0);
      expect(entry.score, `${name}.score`).toBeLessThanOrEqual(100);
    }
  });

  it('all grades are one of A/B/C/D', () => {
    for (const [name, entry] of Object.entries(AUDIT_DB)) {
      expect(['A', 'B', 'C', 'D'], `${name}.grade`).toContain(entry.grade);
    }
  });

  it('voter counts when present are positive integers', () => {
    for (const [name, entry] of Object.entries(AUDIT_DB)) {
      if (entry.voters !== undefined) {
        expect(entry.voters, `${name}.voters`).toBeGreaterThan(0);
        expect(Number.isInteger(entry.voters), `${name}.voters integer`).toBe(true);
      }
    }
  });

  it('has the known-discrete DAOs with expected platforms', () => {
    // Sanity check the entries the architectureClass function references.
    expect(AUDIT_DB.Nouns).toBeDefined();
    expect(AUDIT_DB.Sismo).toBeDefined();
    expect(AUDIT_DB.Aavegotchi).toBeDefined();
    expect(AUDIT_DB.Loopring).toBeDefined();
  });
});

describe('architectureClass', () => {
  it('classifies POP platform as discrete', () => {
    expect(architectureClass('Breadchain', 'POP')).toBe('discrete');
    expect(architectureClass('Giveth', 'POP')).toBe('discrete');
    // POP overrides name — even non-discrete-named orgs on POP are discrete
    expect(architectureClass('RandomOrg', 'POP')).toBe('discrete');
  });

  it('classifies named discrete-cluster DAOs on non-POP platforms', () => {
    expect(architectureClass('Nouns', 'Governor')).toBe('discrete');
    expect(architectureClass('Sismo', 'Snapshot')).toBe('discrete');
    expect(architectureClass('Aavegotchi', 'Snapshot')).toBe('discrete');
    expect(architectureClass('Loopring', 'Snapshot')).toBe('discrete');
  });

  it('defaults everything else to divisible', () => {
    expect(architectureClass('Uniswap', 'Governor')).toBe('divisible');
    expect(architectureClass('Aave', 'Snapshot')).toBe('divisible');
    expect(architectureClass('Unknown DAO', 'Safe')).toBe('divisible');
  });

  it('is case-sensitive on name (guards against unintended match)', () => {
    expect(architectureClass('nouns', 'Governor')).toBe('divisible');  // lowercase
    expect(architectureClass('NOUNS', 'Governor')).toBe('divisible');  // uppercase
  });

  it('handles empty strings defensively', () => {
    expect(architectureClass('', '')).toBe('divisible');
    expect(architectureClass('', 'POP')).toBe('discrete');
  });
});
