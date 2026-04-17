import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';

// These tests cover:
// - env-var fallback for IPFS_API_URL + IPFS_GATEWAY_URL
// - fetchJson zero-hash / bytes32 / CID handling
// - fetchJson error paths (non-ok response, invalid JSON, oversized response)
// - pinJson error + CID-format guards (source-contract)
// - withRetry exponential backoff (via source inspection)
// - pinDirectory empty-list guard

describe('ipfs.ts', () => {
  let originalApi: string | undefined;
  let originalGateway: string | undefined;

  beforeEach(() => {
    originalApi = process.env.POP_IPFS_API_URL;
    originalGateway = process.env.POP_IPFS_GATEWAY_URL;
    delete process.env.POP_IPFS_API_URL;
    delete process.env.POP_IPFS_GATEWAY_URL;
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    if (originalApi !== undefined) process.env.POP_IPFS_API_URL = originalApi;
    else delete process.env.POP_IPFS_API_URL;
    if (originalGateway !== undefined) process.env.POP_IPFS_GATEWAY_URL = originalGateway;
    else delete process.env.POP_IPFS_GATEWAY_URL;
    vi.unstubAllGlobals();
  });

  describe('fetchJson — zero-hash and bytes32 handling', () => {
    it('returns null for empty/falsy input', async () => {
      const { fetchJson } = await import('../../src/lib/ipfs');
      expect(await fetchJson('')).toBeNull();
      expect(await fetchJson(null as any)).toBeNull();
      expect(await fetchJson(undefined as any)).toBeNull();
    });

    it('returns null for all-zero bytes32', async () => {
      const { fetchJson } = await import('../../src/lib/ipfs');
      expect(await fetchJson('0x0000000000000000000000000000000000000000000000000000000000000000')).toBeNull();
      expect(await fetchJson('0x00')).toBeNull();
      expect(await fetchJson('0x' + '0'.repeat(64))).toBeNull();
    });

  });

  describe('fetchJson — fetch error handling (mocked)', () => {
    it('throws wrapped error when gateway returns non-ok', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });
      vi.stubGlobal('fetch', mockFetch);
      const { fetchJson } = await import('../../src/lib/ipfs');
      await expect(fetchJson('QmTest1234567890')).rejects.toThrow(/IPFS fetch failed: 404/);
      // Retry logic: 3 attempts
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('parses JSON successfully on ok response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => '{"foo":"bar"}',
      });
      vi.stubGlobal('fetch', mockFetch);
      const { fetchJson } = await import('../../src/lib/ipfs');
      const result = await fetchJson<{ foo: string }>('QmValidCidString');
      expect(result).toEqual({ foo: 'bar' });
    });

    it('throws on invalid JSON response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => 'not json at all',
      });
      vi.stubGlobal('fetch', mockFetch);
      const { fetchJson } = await import('../../src/lib/ipfs');
      await expect(fetchJson('QmTest')).rejects.toThrow(/Invalid JSON from IPFS/);
    });

    it('throws on response > 10MB', async () => {
      const oversized = 'x'.repeat(10 * 1024 * 1024 + 1);
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => oversized,
      });
      vi.stubGlobal('fetch', mockFetch);
      const { fetchJson } = await import('../../src/lib/ipfs');
      await expect(fetchJson('QmTest')).rejects.toThrow(/too large/);
    });
  });

  describe('pinDirectory guard', () => {
    it('throws on empty file list', async () => {
      const { pinDirectory } = await import('../../src/lib/ipfs');
      await expect(pinDirectory([])).rejects.toThrow(/empty file list/);
    });
  });

  describe('pinJson — CID format validation', () => {
    it('throws when IPFS returns a non-Qm CID (unexpected format)', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ Hash: 'bafybeigdyrzt5...' }), // CIDv1, not CIDv0
      });
      vi.stubGlobal('fetch', mockFetch);
      const { pinJson } = await import('../../src/lib/ipfs');
      await expect(pinJson('{}')).rejects.toThrow(/Unexpected IPFS CID format/);
    });

    it('returns CID when IPFS returns Qm-format hash', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ Hash: 'QmTestHashCid12345' }),
      });
      vi.stubGlobal('fetch', mockFetch);
      const { pinJson } = await import('../../src/lib/ipfs');
      const cid = await pinJson('{"test":1}');
      expect(cid).toBe('QmTestHashCid12345');
    });

    it('retries on failed request (wraps upload error)', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Server Error',
      });
      vi.stubGlobal('fetch', mockFetch);
      const { pinJson } = await import('../../src/lib/ipfs');
      await expect(pinJson('{}')).rejects.toThrow(/IPFS upload failed: 500/);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('source contract — retry + limits', () => {
    it('MAX_RETRIES is 3', () => {
      const src = readFileSync('src/lib/ipfs.ts', 'utf8');
      expect(src).toContain('const MAX_RETRIES = 3');
    });

    it('BASE_DELAY_MS is 1000 (1s exponential backoff start)', () => {
      const src = readFileSync('src/lib/ipfs.ts', 'utf8');
      expect(src).toContain('const BASE_DELAY_MS = 1000');
    });

    it('exponential backoff uses Math.pow(2, attempt)', () => {
      const src = readFileSync('src/lib/ipfs.ts', 'utf8');
      expect(src).toContain('Math.pow(2, attempt)');
    });

    it('10MB size limit enforced in fetchJson', () => {
      const src = readFileSync('src/lib/ipfs.ts', 'utf8');
      expect(src).toContain('10 * 1024 * 1024');
    });

    it('wrapping-dir CID identified by empty Name entry or fallback to last line', () => {
      const src = readFileSync('src/lib/ipfs.ts', 'utf8');
      expect(src).toContain("entry.Name === ''");
      // Fallback path also exists
      expect(src).toContain('lines[lines.length - 1]');
    });

    it('pinDirectory CID accepts both Qm (v0) and bafy (v1) formats', () => {
      const src = readFileSync('src/lib/ipfs.ts', 'utf8');
      expect(src).toContain("!result.startsWith('Qm') && !result.startsWith('bafy')");
    });
  });

  describe('env-var fallback', () => {
    it('DEFAULT_IPFS_API is The Graph endpoint', () => {
      const src = readFileSync('src/lib/ipfs.ts', 'utf8');
      expect(src).toContain("DEFAULT_IPFS_API = 'https://api.thegraph.com/ipfs/api/v0'");
    });

    it('DEFAULT_IPFS_GATEWAY is ipfs.io', () => {
      const src = readFileSync('src/lib/ipfs.ts', 'utf8');
      expect(src).toContain("DEFAULT_IPFS_GATEWAY = 'https://ipfs.io/ipfs/'");
    });

    it('POP_IPFS_API_URL overrides default', () => {
      const src = readFileSync('src/lib/ipfs.ts', 'utf8');
      expect(src).toContain('process.env.POP_IPFS_API_URL || DEFAULT_IPFS_API');
    });

    it('POP_IPFS_GATEWAY_URL overrides default', () => {
      const src = readFileSync('src/lib/ipfs.ts', 'utf8');
      expect(src).toContain('process.env.POP_IPFS_GATEWAY_URL || DEFAULT_IPFS_GATEWAY');
    });
  });

  describe('re-exports', () => {
    it('re-exports bytes32ToIpfsCid + ipfsCidToBytes32 from encoding', async () => {
      const mod = await import('../../src/lib/ipfs');
      expect(typeof mod.bytes32ToIpfsCid).toBe('function');
      expect(typeof mod.ipfsCidToBytes32).toBe('function');
    });
  });
});
