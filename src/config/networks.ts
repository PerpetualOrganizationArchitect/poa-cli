/**
 * Network Configuration
 * Mirrors frontend networks.js for full parity
 */

export interface NetworkConfig {
  chainId: number;
  name: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrl: string;
  blockExplorer: string;
  isTestnet: boolean;
  subgraphUrl: string;
  bountyTokens: Record<string, string>;
}

export const NETWORKS: Record<string, NetworkConfig> = {
  arbitrum: {
    chainId: 42161,
    name: 'Arbitrum One',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    blockExplorer: 'https://arbiscan.io',
    isTestnet: false,
    subgraphUrl: 'https://gateway.thegraph.com/api/204b1629ba85581bdc48cc6701e821ff/subgraphs/id/2egvcs94ZStD38inRtK9bp3Maw3UZw4BDinH8jLyAF4G',
    bountyTokens: {
      USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    },
  },
  gnosis: {
    chainId: 100,
    name: 'Gnosis',
    nativeCurrency: { name: 'xDAI', symbol: 'xDAI', decimals: 18 },
    rpcUrl: 'https://rpc.gnosischain.com',
    blockExplorer: 'https://gnosisscan.io',
    isTestnet: false,
    subgraphUrl: 'https://gateway.thegraph.com/api/204b1629ba85581bdc48cc6701e821ff/subgraphs/id/576YA6oF16nA2uG5Q9KFfBSvJm4ZNKzWZkwh8eWXaxJs',
    bountyTokens: {
      BREAD: '0xa555d5344f6FB6c65da19e403Cb4c1eC4a1a5Ee3',
      USDC: '0xDDAfbb505ad214D7b80b1f830fcCc89B60fB7A83',
      WXDAI: '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d',
    },
  },
  sepolia: {
    chainId: 11155111,
    name: 'Sepolia',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
    blockExplorer: 'https://sepolia.etherscan.io',
    isTestnet: true,
    subgraphUrl: 'https://api.studio.thegraph.com/query/73367/poa-sepolia/version/latest',
    bountyTokens: {
      USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    },
  },
  baseSepolia: {
    chainId: 84532,
    name: 'Base Sepolia',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrl: 'https://base-sepolia-rpc.publicnode.com',
    blockExplorer: 'https://sepolia.basescan.org',
    isTestnet: true,
    subgraphUrl: 'https://api.studio.thegraph.com/query/73367/poa-base-sepolia/version/latest',
    bountyTokens: {
      USDC: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    },
  },
};

/** Home chain for accounts/passkeys */
export const HOME_NETWORK = 'arbitrum';
export const HOME_CHAIN_ID = NETWORKS[HOME_NETWORK].chainId;

/** Default chain for org deployment */
export const DEFAULT_DEPLOY_NETWORK = 'gnosis';
export const DEFAULT_DEPLOY_CHAIN_ID = NETWORKS[DEFAULT_DEPLOY_NETWORK].chainId;

export function getNetworkByChainId(chainId: number): NetworkConfig | null {
  return Object.values(NETWORKS).find(n => n.chainId === chainId) || null;
}

export function getNetworkNameByChainId(chainId: number): string | null {
  const entry = Object.entries(NETWORKS).find(([_, config]) => config.chainId === chainId);
  return entry ? entry[0] : null;
}

export function isNetworkSupported(chainId: number): boolean {
  return !!getNetworkByChainId(chainId);
}

export function getSubgraphUrl(chainId: number): string {
  return getNetworkByChainId(chainId)?.subgraphUrl || NETWORKS[HOME_NETWORK].subgraphUrl;
}

export function getAllSubgraphUrls(): Array<{ chainId: number; url: string; name: string }> {
  return Object.values(NETWORKS)
    .filter(n => !n.isTestnet)
    .map(n => ({ chainId: n.chainId, url: n.subgraphUrl, name: n.name }));
}

/**
 * Resolve the effective network config using env vars + CLI overrides.
 * Priority: CLI flag > per-chain env var > POP_DEFAULT_CHAIN env > error
 */
export function resolveNetworkConfig(chainIdOverride?: number): NetworkConfig & { resolvedRpc: string; resolvedSubgraph: string } {
  const chainId = chainIdOverride
    || (process.env.POP_DEFAULT_CHAIN ? parseInt(process.env.POP_DEFAULT_CHAIN, 10) : undefined);

  if (!chainId) {
    throw new Error('No chain specified. Set POP_DEFAULT_CHAIN in .env or pass --chain flag.');
  }

  const network = getNetworkByChainId(chainId);
  if (!network) {
    throw new Error(`Unsupported chain ID: ${chainId}. Supported: ${Object.values(NETWORKS).map(n => `${n.name} (${n.chainId})`).join(', ')}`);
  }

  // Convert camelCase to UPPER_SNAKE: baseSepolia → BASE_SEPOLIA
  const networkName = getNetworkNameByChainId(chainId)!.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();

  const resolvedRpc = process.env[`POP_${networkName}_RPC`]
    || (chainIdOverride ? undefined : process.env.POP_RPC_URL)
    || network.rpcUrl;

  const resolvedSubgraph = process.env[`POP_${networkName}_SUBGRAPH`]
    || (chainIdOverride ? undefined : process.env.POP_SUBGRAPH_URL)
    || network.subgraphUrl;

  return { ...network, resolvedRpc, resolvedSubgraph };
}
