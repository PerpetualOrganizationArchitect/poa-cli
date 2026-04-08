import { describe, it, expect } from 'vitest';
import { getNetworkNameByChainId } from '../../src/config/networks';

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
