import { describe, it, expect } from 'vitest';
import { expandAliases, LABEL_ALIASES } from '../../src/lib/label-aliases';

describe('label-aliases', () => {
  describe('expandAliases', () => {
    it('always includes the lowercased label as first element', () => {
      expect(expandAliases('Foo')[0]).toBe('foo');
      expect(expandAliases('BAR BAZ')[0]).toBe('bar baz');
    });

    it('returns only the label (lowercased) when no words match', () => {
      expect(expandAliases('RandomProject')).toEqual(['randomproject']);
      expect(expandAliases('Unknown Thing')).toEqual(['unknown thing']);
    });

    it('expands single-word registered labels', () => {
      const out = expandAliases('gitcoin');
      expect(out).toContain('gitcoin');
      expect(out).toContain('gtc');
    });

    it('is case-insensitive on the input label', () => {
      const lower = expandAliases('gitcoin');
      const mixed = expandAliases('Gitcoin');
      const upper = expandAliases('GITCOIN');
      expect(mixed).toEqual(lower);
      expect(upper).toEqual(lower);
    });

    it('expands aliases for ANY whitespace-split word in a multi-word label', () => {
      const out = expandAliases('Curve VotingEscrow');
      expect(out[0]).toBe('curve votingescrow');
      expect(out).toContain('crv');
      expect(out).toContain('vote-escrowed');
    });

    it('does not expand partial-word matches (whole-word split only)', () => {
      const out = expandAliases('curves');
      expect(out).toEqual(['curves']);
      expect(out).not.toContain('crv');
    });

    it('merges aliases from multiple registered words in the same label', () => {
      const out = expandAliases('frax balancer');
      expect(out).toContain('fxs');
      expect(out).toContain('vote-escrowed fxs');
      expect(out).toContain('bal');
      expect(out).toContain('bpt');
    });

    it('tolerates irregular whitespace (filter empty splits)', () => {
      const out = expandAliases('  gitcoin   ');
      expect(out[0]).toBe('  gitcoin   '.toLowerCase());
      expect(out).toContain('gtc');
    });

    it('handles the veNFT convention for Solidly-style projects', () => {
      const velo = expandAliases('velodrome');
      const aero = expandAliases('aerodrome');
      expect(velo).toContain('venft');
      expect(aero).toContain('venft');
      expect(velo).toContain('velo');
      expect(aero).toContain('aero');
    });
  });

  describe('LABEL_ALIASES map', () => {
    it('keys are all lowercase', () => {
      for (const key of Object.keys(LABEL_ALIASES)) {
        expect(key).toBe(key.toLowerCase());
      }
    });

    it('values are all lowercase arrays', () => {
      for (const values of Object.values(LABEL_ALIASES)) {
        for (const v of values) {
          expect(v).toBe(v.toLowerCase());
        }
      }
    });

    it('covers the projects asserted by the file header (gitcoin, curve, balancer, frax, velodrome, aerodrome)', () => {
      expect(LABEL_ALIASES.gitcoin).toBeDefined();
      expect(LABEL_ALIASES.curve).toBeDefined();
      expect(LABEL_ALIASES.balancer).toBeDefined();
      expect(LABEL_ALIASES.frax).toBeDefined();
      expect(LABEL_ALIASES.velodrome).toBeDefined();
      expect(LABEL_ALIASES.aerodrome).toBeDefined();
    });
  });
});
