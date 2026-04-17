import { describe, it, expect } from 'vitest';
import {
  IDENTITY_REGISTRY,
  REGISTRY_ABI,
  buildAgentMetadata,
  type AgentMetadata,
  type BuildMetadataOptions,
} from '../../src/lib/erc8004';

describe('IDENTITY_REGISTRY', () => {
  it('is the canonical cross-chain registry address', () => {
    expect(IDENTITY_REGISTRY).toBe('0x8004A169FB4a3325136EB29fA0ceB6D2e539a432');
  });

  it('is a valid 0x-prefixed 20-byte address', () => {
    expect(IDENTITY_REGISTRY).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });
});

describe('REGISTRY_ABI', () => {
  it('has all expected function signatures', () => {
    const sigs = REGISTRY_ABI.join(',');
    expect(sigs).toContain('register(string');
    expect(sigs).toContain('balanceOf(address)');
    expect(sigs).toContain('tokenOfOwnerByIndex(address');
    expect(sigs).toContain('tokenURI(uint256');
    expect(sigs).toContain('ownerOf(uint256');
  });
});

describe('buildAgentMetadata', () => {
  const baseOpts: BuildMetadataOptions = {
    name: 'test_agent',
    walletAddress: '0xabcdef0000000000000000000000000000000001',
    chainId: 100,
  };

  it('produces a minimal valid metadata record', () => {
    const m = buildAgentMetadata(baseOpts);
    expect(m.name).toBe('test_agent');
    expect(m.active).toBe(true);
    expect(m.services.length).toBe(1);
    expect(m.services[0].type).toBe('wallet');
    expect(m.services[0].address).toBe(baseOpts.walletAddress);
    expect(m.services[0].chain).toBe('eip155:100');
    expect(m.protocols).toContain('POP');
    expect(m.protocols).toContain('ERC-8004');
    expect(m.capabilities).toEqual(['governance', 'task-completion']);
  });

  it('defaults description when not provided', () => {
    const m = buildAgentMetadata(baseOpts);
    expect(m.description).toContain('chain 100');
  });

  it('uses provided description override', () => {
    const m = buildAgentMetadata({ ...baseOpts, description: 'custom description' });
    expect(m.description).toBe('custom description');
  });

  it('uses provided capabilities override', () => {
    const m = buildAgentMetadata({ ...baseOpts, capabilities: ['audit', 'research'] });
    expect(m.capabilities).toEqual(['audit', 'research']);
  });

  it('adds MCP endpoint service when provided', () => {
    const m = buildAgentMetadata({ ...baseOpts, mcpEndpoint: 'https://mcp.example.com' });
    const mcp = m.services.find(s => s.type === 'mcp');
    expect(mcp).toBeDefined();
    expect(mcp?.url).toBe('https://mcp.example.com');
  });

  it('adds A2A endpoint service when provided', () => {
    const m = buildAgentMetadata({ ...baseOpts, a2aEndpoint: 'https://a2a.example.com' });
    const a2a = m.services.find(s => s.type === 'a2a');
    expect(a2a).toBeDefined();
    expect(a2a?.url).toBe('https://a2a.example.com');
  });

  it('adds both MCP and A2A services when both provided', () => {
    const m = buildAgentMetadata({
      ...baseOpts,
      mcpEndpoint: 'https://mcp.example.com',
      a2aEndpoint: 'https://a2a.example.com',
    });
    expect(m.services.length).toBe(3);  // wallet + mcp + a2a
  });

  it('adds x402 protocol + support when x402Enabled', () => {
    const m = buildAgentMetadata({ ...baseOpts, x402Enabled: true });
    expect(m.protocols).toContain('x402');
    expect(m.x402Support).toBeDefined();
    expect(m.x402Support?.enabled).toBe(true);
    expect(m.x402Support?.supportedNetworks).toEqual(['eip155:100']);
  });

  it('omits x402 support when not enabled', () => {
    const m = buildAgentMetadata(baseOpts);
    expect(m.protocols).not.toContain('x402');
    expect(m.x402Support).toBeUndefined();
  });

  it('adds org block when orgName provided', () => {
    const m = buildAgentMetadata({ ...baseOpts, orgName: 'Argus' });
    expect(m.org).toBeDefined();
    expect(m.org?.name).toBe('Argus');
    expect(m.org?.protocol).toBe('POP');
    expect(m.org?.chainId).toBe(100);
  });

  it('omits org block when orgName not provided', () => {
    const m = buildAgentMetadata(baseOpts);
    expect(m.org).toBeUndefined();
  });

  it('registeredAt is a valid ISO 8601 timestamp', () => {
    const m = buildAgentMetadata(baseOpts);
    expect(() => new Date(m.registeredAt).toISOString()).not.toThrow();
    expect(m.registeredAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('uses correct CAIP-2 chain format for different chain IDs', () => {
    const mainnet = buildAgentMetadata({ ...baseOpts, chainId: 1 });
    expect(mainnet.services[0].chain).toBe('eip155:1');
    const arb = buildAgentMetadata({ ...baseOpts, chainId: 42161 });
    expect(arb.services[0].chain).toBe('eip155:42161');
  });
});
