import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  setJsonMode,
  isJsonMode,
  success,
  error,
  info,
  warn,
  subgraphLagWarning,
  json,
  spinner,
} from '../../src/lib/output';

let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  setJsonMode(false);
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
  errSpy.mockRestore();
  setJsonMode(false);
});

describe('output', () => {
  describe('setJsonMode / isJsonMode', () => {
    it('defaults to false', () => {
      expect(isJsonMode()).toBe(false);
    });
    it('toggles via setJsonMode', () => {
      setJsonMode(true);
      expect(isJsonMode()).toBe(true);
      setJsonMode(false);
      expect(isJsonMode()).toBe(false);
    });
  });

  describe('success', () => {
    it('text mode writes ✓ prefix + message + key/value data', () => {
      success('deployed', { addr: '0xabc', explorerUrl: 'https://explorer/tx/0x1' });
      const calls = logSpy.mock.calls.map((c) => c[0]);
      expect(calls.some((c) => typeof c === 'string' && c.includes('deployed'))).toBe(true);
      expect(calls.some((c) => typeof c === 'string' && c.includes('0xabc'))).toBe(true);
      expect(calls.some((c) => typeof c === 'string' && c.includes('https://explorer/tx/0x1'))).toBe(true);
    });

    it('text mode skips undefined/null data values', () => {
      success('ok', { keep: 'yes', drop: undefined, alsoDrop: null });
      const calls = logSpy.mock.calls.map((c) => String(c[0])).join('|');
      expect(calls).toContain('yes');
      expect(calls).not.toContain('undefined');
    });

    it('json mode emits a single JSON line with status=ok + data merged', () => {
      setJsonMode(true);
      success('done', { txHash: '0xdeadbeef' });
      expect(logSpy.mock.calls.length).toBe(1);
      const line = logSpy.mock.calls[0][0];
      const obj = JSON.parse(String(line));
      expect(obj.status).toBe('ok');
      expect(obj.message).toBe('done');
      expect(obj.txHash).toBe('0xdeadbeef');
    });
  });

  describe('error', () => {
    it('text mode writes ✗ + message to stderr, optional suggestion', () => {
      error('failed', { suggestion: 'try again' });
      const calls = errSpy.mock.calls.map((c) => String(c[0])).join('|');
      expect(calls).toContain('failed');
      expect(calls).toContain('try again');
    });

    it('json mode emits status=error payload with code + detail + suggestion if provided', () => {
      setJsonMode(true);
      error('boom', { errorCode: 42, error: 'deep reason', suggestion: 'retry' });
      expect(errSpy.mock.calls.length).toBe(1);
      const obj = JSON.parse(String(errSpy.mock.calls[0][0]));
      expect(obj).toEqual({ status: 'error', message: 'boom', code: 42, detail: 'deep reason', suggestion: 'retry' });
    });

    it('json mode omits optional fields when not provided', () => {
      setJsonMode(true);
      error('boom');
      const obj = JSON.parse(String(errSpy.mock.calls[0][0]));
      expect(obj).toEqual({ status: 'error', message: 'boom' });
      expect(obj.code).toBeUndefined();
    });
  });

  describe('info / warn / subgraphLagWarning', () => {
    it('info writes in text mode', () => {
      info('heads up');
      expect(logSpy.mock.calls.length).toBe(1);
      expect(String(logSpy.mock.calls[0][0])).toContain('heads up');
    });

    it('info is silent in json mode', () => {
      setJsonMode(true);
      info('heads up');
      expect(logSpy.mock.calls.length).toBe(0);
    });

    it('warn writes in text mode, silent in json mode', () => {
      warn('careful');
      expect(logSpy.mock.calls.length).toBe(1);
      logSpy.mockClear();
      setJsonMode(true);
      warn('careful');
      expect(logSpy.mock.calls.length).toBe(0);
    });

    it('subgraphLagWarning writes in text mode, silent in json mode', () => {
      subgraphLagWarning();
      expect(logSpy.mock.calls.length).toBe(1);
      logSpy.mockClear();
      setJsonMode(true);
      subgraphLagWarning();
      expect(logSpy.mock.calls.length).toBe(0);
    });
  });

  describe('json helper', () => {
    it('text mode pretty-prints (2-space indent)', () => {
      json({ a: 1, b: 2 });
      const out = String(logSpy.mock.calls[0][0]);
      expect(out).toContain('\n');
      expect(out).toContain('  "a"');
    });

    it('json mode emits a single compact line (no indentation)', () => {
      setJsonMode(true);
      json({ a: 1, b: 2 });
      const out = String(logSpy.mock.calls[0][0]);
      expect(out.includes('\n')).toBe(false);
      expect(JSON.parse(out)).toEqual({ a: 1, b: 2 });
    });
  });

  describe('spinner', () => {
    it('json mode returns a chainable no-op (all methods return self)', () => {
      setJsonMode(true);
      const s: any = spinner('loading');
      expect(s.text).toBe('loading');
      expect(s.isSpinning).toBe(false);
      // All these should be chainable and not throw
      expect(s.start()).toBe(s);
      expect(s.stop()).toBe(s);
      expect(s.succeed()).toBe(s);
      expect(s.fail()).toBe(s);
      expect(s.warn()).toBe(s);
      expect(s.info()).toBe(s);
      expect(s.clear()).toBe(s);
      expect(s.render()).toBe(s);
    });

    it('text mode returns a real ora spinner instance (has start + stop)', () => {
      const s = spinner('loading');
      expect(typeof s.start).toBe('function');
      expect(typeof s.stop).toBe('function');
      // ora instances have a `text` getter/setter
      expect(s.text).toBe('loading');
    });
  });
});
