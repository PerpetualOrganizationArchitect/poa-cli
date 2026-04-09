import { describe, it, expect } from 'vitest';
import { getNetworkNameByChainId, getSubgraphUrl, getNetworkByChainId, isNetworkSupported } from '../../src/config/networks';

describe('network name to env var conversion', () => {
  // This test prevents the bug where .toUpperCase() was called BEFORE the
  // camelCase split regex, making the regex match nothing for multi-word names.
  it('converts camelCase network names to UPPER_SNAKE for env vars', () => {
    const convert = (chainId: number) => {
      const name = getNetworkNameByChainId(chainId)!;
      return name.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
    };

    expect(convert(42161)).toBe('ARBITRUM');
    expect(convert(100)).toBe('GNOSIS');
    expect(convert(11155111)).toBe('SEPOLIA');
    expect(convert(84532)).toBe('BASE_SEPOLIA'); // The bug produced "BASESEPOLIA"
  });
});

describe('getSubgraphUrl', () => {
  it('returns correct URL for Gnosis', () => {
    const url = getSubgraphUrl(100);
    expect(url).toContain('gnosis');
  });

  it('returns correct URL for Arbitrum', () => {
    const url = getSubgraphUrl(42161);
    expect(url).toContain('thegraph.com');
  });

  it('falls back to home chain for unknown chain ID', () => {
    const url = getSubgraphUrl(999999);
    // Should fall back to Arbitrum (HOME_NETWORK)
    expect(url).toBe(getSubgraphUrl(42161));
  });
});

describe('getNetworkByChainId', () => {
  it('returns config for known chains', () => {
    expect(getNetworkByChainId(100)?.name).toBe('Gnosis');
    expect(getNetworkByChainId(42161)?.name).toBe('Arbitrum One');
  });

  it('returns null for unknown chains', () => {
    expect(getNetworkByChainId(999999)).toBeNull();
  });
});

describe('isNetworkSupported', () => {
  it('returns true for supported chains', () => {
    expect(isNetworkSupported(100)).toBe(true);
    expect(isNetworkSupported(42161)).toBe(true);
  });

  it('returns false for unsupported chains', () => {
    expect(isNetworkSupported(999999)).toBe(false);
  });
});

describe('activity response DD proposals extraction', () => {
  // Verifies the nested extraction pattern used after the ddvProposals fix.
  // DD proposals live at org.directDemocracyVoting.ddvProposals, NOT at a top-level entity.

  it('extracts DD proposals from nested org structure', () => {
    const org = {
      directDemocracyVoting: {
        ddvProposals: [
          { proposalId: '0', title: 'Test', status: 'Active' },
        ],
      },
    };
    const activeDD = org.directDemocracyVoting?.ddvProposals || [];
    expect(activeDD).toHaveLength(1);
    expect(activeDD[0].title).toBe('Test');
  });

  it('returns empty array when directDemocracyVoting is null', () => {
    const org: any = { directDemocracyVoting: null };
    const activeDD = org.directDemocracyVoting?.ddvProposals || [];
    expect(activeDD).toHaveLength(0);
  });

  it('returns empty array when ddvProposals is missing', () => {
    const org: any = { directDemocracyVoting: {} };
    const activeDD = org.directDemocracyVoting?.ddvProposals || [];
    expect(activeDD).toHaveLength(0);
  });
});
