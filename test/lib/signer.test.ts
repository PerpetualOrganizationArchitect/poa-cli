import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createSigner, createProvider } from '../../src/lib/signer';

// A randomly generated private key for test purposes — NOT used by any agent.
// 32 bytes of hex. Do NOT reuse in production code.
const TEST_KEY = '0x4c0883a69102937d6231471b5dbb6204fe5129617082798f0dd41e13739ffecf';
const EXPECTED_ADDR = '0x36F914eFC554f304B75A03821919Ff65DF729F4A';

let origKey: string | undefined;

beforeEach(() => {
  origKey = process.env.POP_PRIVATE_KEY;
  delete process.env.POP_PRIVATE_KEY;
});

afterEach(() => {
  if (origKey === undefined) delete process.env.POP_PRIVATE_KEY;
  else process.env.POP_PRIVATE_KEY = origKey;
});

describe('signer', () => {
  describe('createSigner', () => {
    it('returns a SignerContext with wallet + provider + address + chainId', () => {
      const ctx = createSigner({ privateKey: TEST_KEY, chainId: 100 });
      expect(ctx.signer).toBeDefined();
      expect(ctx.provider).toBeDefined();
      expect(ctx.address).toBe(EXPECTED_ADDR);
      expect(ctx.chainId).toBe(100);
    });

    it('prefers --private-key flag over POP_PRIVATE_KEY env', () => {
      process.env.POP_PRIVATE_KEY = '0xdeadbeef' + '00'.repeat(30);
      const ctx = createSigner({ privateKey: TEST_KEY, chainId: 100 });
      expect(ctx.address).toBe(EXPECTED_ADDR);
    });

    it('falls back to POP_PRIVATE_KEY env when no flag provided', () => {
      process.env.POP_PRIVATE_KEY = TEST_KEY;
      const ctx = createSigner({ chainId: 100 });
      expect(ctx.address).toBe(EXPECTED_ADDR);
    });

    it('throws helpful error when neither flag nor env provides a key', () => {
      expect(() => createSigner({ chainId: 100 })).toThrow(
        /No private key provided/,
      );
      expect(() => createSigner({ chainId: 100 })).toThrow(
        /POP_PRIVATE_KEY/,
      );
      expect(() => createSigner({ chainId: 100 })).toThrow(
        /--private-key/,
      );
    });

    it('uses custom rpcUrl when provided', () => {
      const ctx = createSigner({
        privateKey: TEST_KEY,
        chainId: 100,
        rpcUrl: 'https://custom.rpc/path',
      });
      // provider's connection URL should reflect the override
      expect((ctx.provider as any).connection.url).toBe('https://custom.rpc/path');
    });

    it('uses resolved network RPC when no rpcUrl provided', () => {
      const ctx = createSigner({ privateKey: TEST_KEY, chainId: 100 });
      // default Gnosis config resolves to a known RPC
      expect(typeof (ctx.provider as any).connection.url).toBe('string');
      expect((ctx.provider as any).connection.url.length).toBeGreaterThan(0);
    });

    it('signer is connected to the provider (enables tx operations)', () => {
      const ctx = createSigner({ privateKey: TEST_KEY, chainId: 100 });
      // Ethers Wallet.provider is the connected provider
      expect((ctx.signer as any).provider).toBe(ctx.provider);
    });
  });

  describe('createProvider', () => {
    it('returns a JsonRpcProvider connected to the resolved network', () => {
      const provider = createProvider({ chainId: 100 });
      expect(provider).toBeDefined();
      expect((provider as any).connection.url).toBeDefined();
    });

    it('uses custom rpcUrl override', () => {
      const provider = createProvider({ chainId: 100, rpcUrl: 'https://x.example/rpc' });
      expect((provider as any).connection.url).toBe('https://x.example/rpc');
    });

    it('does not require a private key (read-only)', () => {
      // Even with POP_PRIVATE_KEY unset (per beforeEach), createProvider works.
      expect(() => createProvider({ chainId: 100 })).not.toThrow();
    });
  });
});
