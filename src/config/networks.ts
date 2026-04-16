/**
 * Network Configuration
 * Mirrors frontend networks.js for full parity on POP-deployed chains.
 *
 * Chains come in two flavors:
 *   1. POP-deployed chains (Gnosis, Arbitrum, Sepolia, BaseSepolia) — full
 *      subgraph + deployment support. Set `isExternal: false` (default).
 *   2. External chains (Ethereum mainnet, Optimism, Base, Polygon) — no POP
 *      deployment, no POP subgraph. Used by read-only commands like
 *      `pop org probe-access` to inspect foreign governance contracts
 *      (Compound Governor Bravo, Aave V3, Uniswap, etc). Set
 *      `isExternal: true` so subgraph sweepers skip them.
 *
 * Adding an external chain: set `isExternal: true`, leave `subgraphUrl: ''`,
 * and use an empty `bountyTokens` map. Commands that require a POP subgraph
 * (org activity, task lists, proposal history) will refuse to run on external
 * chains — probe-access and other foreign-contract tools work fine.
 */

export interface NetworkConfig {
  chainId: number;
  name: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrl: string;
  blockExplorer: string;
  isTestnet: boolean;
  /**
   * True if POP is NOT deployed on this chain. External chains are
   * useful for read-only contract inspection (probe-access) but
   * cannot be used for POP operations like task management, voting,
   * treasury, or governance. Defaults to false when omitted.
   */
  isExternal?: boolean;
  /**
   * Default block range per getLogs chunk for this chain. L2 chains have
   * stricter RPC limits than L1 — Optimism/Base public RPCs reject ranges
   * above ~2000-5000 blocks. Commands like audit-vetoken use this value
   * when the user doesn't pass --chunk. Defaults to 10000 when omitted.
   */
  defaultLogsChunkBlocks?: number;
  subgraphUrl: string;
  bountyTokens: Record<string, string>;
}

export const NETWORKS: Record<string, NetworkConfig> = {
  arbitrum: {
    chainId: 42161,
    name: 'Arbitrum One',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrl: 'https://arbitrum-one-rpc.publicnode.com',
    defaultLogsChunkBlocks: 2000,
    blockExplorer: 'https://arbiscan.io',
    isTestnet: false,
    subgraphUrl: 'https://api.studio.thegraph.com/query/73367/poa-arb-v-1/version/latest',
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
    subgraphUrl: 'https://api.studio.thegraph.com/query/73367/poa-gnosis-v-1/version/latest',
    bountyTokens: {
      BREAD: '0xa555d5344f6FB6c65da19e403Cb4c1eC4a1a5Ee3',
      USDC: '0xDDAfbb505ad214D7b80b1f830fcCc89B60fB7A83',
      WXDAI: '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d',
      sDAI: '0xaf204776c7245bF4147c2612BF6e5972Ee483701',
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
  // ---------------------------------------------------------------------
  // External chains (HB#326, task #341) — read-only probe targets.
  // POP is NOT deployed on any of these. Added so `pop org probe-access
  // --chain <id>` works without the --rpc workaround from HB#336. See
  // the NetworkConfig.isExternal field comment at the top of this file
  // for the semantics.
  // ---------------------------------------------------------------------
  ethereum: {
    chainId: 1,
    name: 'Ethereum',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrl: 'https://ethereum.publicnode.com',
    blockExplorer: 'https://etherscan.io',
    isTestnet: false,
    isExternal: true,
    subgraphUrl: '',
    bountyTokens: {},
  },
  optimism: {
    chainId: 10,
    name: 'Optimism',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrl: 'https://optimism-rpc.publicnode.com',
    blockExplorer: 'https://optimistic.etherscan.io',
    isTestnet: false,
    isExternal: true,
    defaultLogsChunkBlocks: 2000,
    subgraphUrl: '',
    bountyTokens: {},
  },
  base: {
    chainId: 8453,
    name: 'Base',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrl: 'https://base-rpc.publicnode.com',
    blockExplorer: 'https://basescan.org',
    isTestnet: false,
    isExternal: true,
    defaultLogsChunkBlocks: 2000,
    subgraphUrl: '',
    bountyTokens: {},
  },
  polygon: {
    chainId: 137,
    name: 'Polygon',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    rpcUrl: 'https://polygon-bor-rpc.publicnode.com',
    blockExplorer: 'https://polygonscan.com',
    isTestnet: false,
    isExternal: true,
    subgraphUrl: '',
    bountyTokens: {},
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
  // External chains (Ethereum mainnet, Optimism, Base, Polygon) have no
  // POP subgraph and are read-only probe targets only. Filter them out
  // here so the subgraph sweeper never tries to query a nonexistent URL.
  return Object.values(NETWORKS)
    .filter(n => !n.isTestnet && !n.isExternal && n.subgraphUrl)
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
