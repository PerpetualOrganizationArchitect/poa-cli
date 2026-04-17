/**
 * ERC-8004 Identity Registry
 *
 * Shared constants, types, and helpers for the ERC-8004 Trustless Agents registry.
 * Registry address is the same on all chains.
 */

import { ethers } from 'ethers';

// ERC-8004 Identity Registry — same address on all chains
export const IDENTITY_REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';

export const REGISTRY_ABI = [
  'function register(string agentURI) external returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function ownerOf(uint256 tokenId) view returns (address)',
];

// --- Types ---

export interface AgentService {
  type: 'wallet' | 'mcp' | 'a2a' | 'http';
  address?: string;
  url?: string;
  chain?: string; // CAIP-2 format: eip155:<chainId>
  description?: string;
}

export interface AgentX402Support {
  enabled: boolean;
  supportedNetworks: string[]; // CAIP-2 IDs
}

export interface AgentMetadata {
  name: string;
  description: string;
  services: AgentService[];
  capabilities: string[];
  protocols: string[];
  x402Support?: AgentX402Support;
  org?: { name: string; protocol: string; chainId?: number };
  active: boolean;
  registeredAt: string;
}

// --- Metadata Builder ---

export interface BuildMetadataOptions {
  name: string;
  description?: string;
  walletAddress: string;
  chainId: number;
  capabilities?: string[];
  orgName?: string;
  mcpEndpoint?: string;
  a2aEndpoint?: string;
  x402Enabled?: boolean;
}

export function buildAgentMetadata(opts: BuildMetadataOptions): AgentMetadata {
  const services: AgentService[] = [
    { type: 'wallet', address: opts.walletAddress, chain: `eip155:${opts.chainId}` },
  ];

  if (opts.mcpEndpoint) {
    services.push({ type: 'mcp', url: opts.mcpEndpoint, description: 'MCP server endpoint' });
  }
  if (opts.a2aEndpoint) {
    services.push({ type: 'a2a', url: opts.a2aEndpoint, description: 'A2A protocol endpoint' });
  }

  const protocols = ['POP', 'ERC-8004'];

  const metadata: AgentMetadata = {
    name: opts.name,
    description: opts.description || `AI agent operating on chain ${opts.chainId}`,
    services,
    capabilities: opts.capabilities || ['governance', 'task-completion'],
    protocols,
    active: true,
    registeredAt: new Date().toISOString(),
  };

  if (opts.x402Enabled) {
    metadata.x402Support = {
      enabled: true,
      supportedNetworks: [`eip155:${opts.chainId}`],
    };
    metadata.protocols.push('x402');
  }

  if (opts.orgName) {
    metadata.org = { name: opts.orgName, protocol: 'POP', chainId: opts.chainId };
  }

  return metadata;
}

// --- Registry Helpers ---

export async function isRegistered(
  address: string,
  provider: ethers.providers.Provider,
): Promise<boolean> {
  const registry = new ethers.Contract(IDENTITY_REGISTRY, REGISTRY_ABI, provider);
  try {
    const balance = await registry.balanceOf(address);
    return balance.gt(0);
  } catch {
    return false; // registry may not exist on this chain
  }
}

export async function getAgentTokenId(
  address: string,
  provider: ethers.providers.Provider,
): Promise<string | null> {
  const registry = new ethers.Contract(IDENTITY_REGISTRY, REGISTRY_ABI, provider);
  try {
    const balance = await registry.balanceOf(address);
    if (balance.eq(0)) return null;
    const tokenId = await registry.tokenOfOwnerByIndex(address, 0);
    return tokenId.toString();
  } catch {
    return null;
  }
}

export async function lookupAgentById(
  tokenId: string,
  provider: ethers.providers.Provider,
): Promise<{ tokenId: string; owner: string; uri: string; metadata: AgentMetadata | null }> {
  const registry = new ethers.Contract(IDENTITY_REGISTRY, REGISTRY_ABI, provider);
  const [owner, uri] = await Promise.all([
    registry.ownerOf(tokenId),
    registry.tokenURI(tokenId),
  ]);

  let metadata: AgentMetadata | null = null;
  try {
    // Resolve IPFS URI to HTTP gateway
    const httpUrl = uri.startsWith('ipfs://')
      ? uri.replace('ipfs://', 'https://ipfs.io/ipfs/')
      : uri;
    const res = await fetch(httpUrl);
    if (res.ok) {
      metadata = await res.json();
    }
  } catch {
    // metadata fetch failed — return null metadata
  }

  return { tokenId, owner, uri, metadata };
}

export async function lookupAgentByAddress(
  address: string,
  provider: ethers.providers.Provider,
): Promise<{ tokenId: string; owner: string; uri: string; metadata: AgentMetadata | null } | null> {
  const tokenId = await getAgentTokenId(address, provider);
  if (!tokenId) return null;
  return lookupAgentById(tokenId, provider);
}
