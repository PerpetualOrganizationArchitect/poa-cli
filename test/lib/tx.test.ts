import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveSponsoredConfig } from '../../src/lib/tx';

const ENV_KEYS = ['POP_PRIVATE_KEY', 'POP_ORG_ID', 'POP_HAT_ID', 'PIMLICO_API_KEY'] as const;

// Snapshot + restore env around each test to avoid polluting other tests.
const original: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const k of ENV_KEYS) {
    original[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (original[k] === undefined) delete process.env[k];
    else process.env[k] = original[k];
  }
});

describe('resolveSponsoredConfig', () => {
  it('returns undefined when all env vars are missing', () => {
    expect(resolveSponsoredConfig()).toBeUndefined();
  });

  it('returns undefined when POP_PRIVATE_KEY is missing', () => {
    process.env.POP_ORG_ID = '0x1234';
    process.env.POP_HAT_ID = '42';
    process.env.PIMLICO_API_KEY = 'pim_x';
    expect(resolveSponsoredConfig()).toBeUndefined();
  });

  it('returns undefined when POP_ORG_ID is missing', () => {
    process.env.POP_PRIVATE_KEY = '0xabc';
    process.env.POP_HAT_ID = '42';
    process.env.PIMLICO_API_KEY = 'pim_x';
    expect(resolveSponsoredConfig()).toBeUndefined();
  });

  it('returns undefined when POP_HAT_ID is missing', () => {
    process.env.POP_PRIVATE_KEY = '0xabc';
    process.env.POP_ORG_ID = '0x1234';
    process.env.PIMLICO_API_KEY = 'pim_x';
    expect(resolveSponsoredConfig()).toBeUndefined();
  });

  it('returns undefined when PIMLICO_API_KEY is missing', () => {
    process.env.POP_PRIVATE_KEY = '0xabc';
    process.env.POP_ORG_ID = '0x1234';
    process.env.POP_HAT_ID = '42';
    expect(resolveSponsoredConfig()).toBeUndefined();
  });

  it('returns populated config when all 4 env vars are set', () => {
    process.env.POP_PRIVATE_KEY = '0xdeadbeef'.padEnd(66, '0');
    process.env.POP_ORG_ID = '0x1234';
    process.env.POP_HAT_ID = '42';
    process.env.PIMLICO_API_KEY = 'pim_test';
    const cfg = resolveSponsoredConfig();
    expect(cfg).toBeDefined();
    expect(cfg!.privateKey).toBe('0xdeadbeef'.padEnd(66, '0'));
    expect(cfg!.orgId).toBe('0x1234');
    expect(cfg!.hatId).toBe(42n);
  });

  it('adds 0x prefix to private key when missing', () => {
    process.env.POP_PRIVATE_KEY = 'deadbeef'.padEnd(64, '0');
    process.env.POP_ORG_ID = '0x1234';
    process.env.POP_HAT_ID = '42';
    process.env.PIMLICO_API_KEY = 'pim_test';
    const cfg = resolveSponsoredConfig();
    expect(cfg!.privateKey).toMatch(/^0x/);
  });

  it('preserves 0x prefix on private key when already present', () => {
    const keyWith0x = '0xdeadbeef'.padEnd(66, '0');
    process.env.POP_PRIVATE_KEY = keyWith0x;
    process.env.POP_ORG_ID = '0x1234';
    process.env.POP_HAT_ID = '42';
    process.env.PIMLICO_API_KEY = 'pim_test';
    expect(resolveSponsoredConfig()!.privateKey).toBe(keyWith0x);
  });

  it('converts POP_HAT_ID string to bigint', () => {
    process.env.POP_PRIVATE_KEY = '0xabc';
    process.env.POP_ORG_ID = '0x1234';
    process.env.POP_HAT_ID = '30222100625258283641858621132055137413908072809768050515156576961036288';
    process.env.PIMLICO_API_KEY = 'pim_test';
    const cfg = resolveSponsoredConfig();
    expect(typeof cfg!.hatId).toBe('bigint');
    expect(cfg!.hatId).toBe(30222100625258283641858621132055137413908072809768050515156576961036288n);
  });

  it('empty string env values are treated as missing', () => {
    process.env.POP_PRIVATE_KEY = '';
    process.env.POP_ORG_ID = '0x1234';
    process.env.POP_HAT_ID = '42';
    process.env.PIMLICO_API_KEY = 'pim_test';
    expect(resolveSponsoredConfig()).toBeUndefined();
  });
});
