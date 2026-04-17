import { describe, it, expect } from 'vitest';
import {
  CliError,
  TxRevertError,
  NetworkError,
  SubgraphError,
  IpfsError,
} from '../../src/lib/errors';

describe('errors', () => {
  describe('CliError (base class)', () => {
    it('sets message, default code=1, name="CliError"', () => {
      const e = new CliError('something broke');
      expect(e.message).toBe('something broke');
      expect(e.code).toBe(1);
      expect(e.name).toBe('CliError');
      expect(e.suggestion).toBeUndefined();
    });

    it('accepts custom code + suggestion', () => {
      const e = new CliError('bad input', 42, 'try --help');
      expect(e.code).toBe(42);
      expect(e.suggestion).toBe('try --help');
    });

    it('is an Error (instanceof) so catch blocks work', () => {
      const e = new CliError('x');
      expect(e instanceof Error).toBe(true);
      expect(e instanceof CliError).toBe(true);
    });
  });

  describe('TxRevertError', () => {
    it('prefixes the reason, sets code=2, attaches permissions suggestion', () => {
      const e = new TxRevertError('ONLY_MEMBER');
      expect(e.message).toBe('Transaction reverted: ONLY_MEMBER');
      expect(e.code).toBe(2);
      expect(e.name).toBe('TxRevertError');
      expect(e.suggestion).toContain('permissions');
    });

    it('is instanceof CliError (hierarchy for catch discriminants)', () => {
      const e = new TxRevertError('x');
      expect(e instanceof CliError).toBe(true);
      expect(e instanceof TxRevertError).toBe(true);
      expect(e instanceof Error).toBe(true);
    });
  });

  describe('NetworkError', () => {
    it('prefixes the message, sets code=3, suggests RPC check', () => {
      const e = new NetworkError('connection refused');
      expect(e.message).toBe('Network error: connection refused');
      expect(e.code).toBe(3);
      expect(e.name).toBe('NetworkError');
      expect(e.suggestion).toContain('RPC');
    });

    it('is instanceof CliError', () => {
      expect(new NetworkError('x') instanceof CliError).toBe(true);
    });
  });

  describe('SubgraphError', () => {
    it('prefixes the message, sets code=3, suggests subgraph URL check', () => {
      const e = new SubgraphError('404 Not Found');
      expect(e.message).toBe('Subgraph error: 404 Not Found');
      expect(e.code).toBe(3);
      expect(e.name).toBe('SubgraphError');
      expect(e.suggestion).toContain('subgraph');
    });

    it('is instanceof CliError', () => {
      expect(new SubgraphError('x') instanceof CliError).toBe(true);
    });
  });

  describe('IpfsError', () => {
    it('prefixes the message, sets code=3, mentions temporary availability', () => {
      const e = new IpfsError('gateway 502');
      expect(e.message).toBe('IPFS error: gateway 502');
      expect(e.code).toBe(3);
      expect(e.name).toBe('IpfsError');
      expect(e.suggestion).toContain('IPFS');
    });

    it('is instanceof CliError', () => {
      expect(new IpfsError('x') instanceof CliError).toBe(true);
    });
  });

  describe('code discrimination (catch-block usage contract)', () => {
    it('code=2 uniquely identifies tx revert', () => {
      const errors = [new CliError('a'), new TxRevertError('b'), new NetworkError('c')];
      const codes = errors.map((e) => e.code);
      expect(codes.filter((c) => c === 2).length).toBe(1);
    });

    it('code=3 identifies network-class failures (Network/Subgraph/Ipfs)', () => {
      const errors = [new NetworkError('a'), new SubgraphError('b'), new IpfsError('c')];
      for (const e of errors) expect(e.code).toBe(3);
    });
  });
});
