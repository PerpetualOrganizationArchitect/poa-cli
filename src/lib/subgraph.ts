/**
 * Subgraph Client
 * Lightweight GraphQL client for querying The Graph subgraphs.
 *
 * Strategy: Use Studio (free, 3K queries/day) as primary. On 429 rate limit,
 * fall back to Gateway (paid, needs API key). Once switched, stay on Gateway
 * for the rest of the process lifetime. Next restart tries Studio again.
 */

import { GraphQLClient } from 'graphql-request';
import { resolveNetworkConfig, getNetworkNameByChainId, getAllSubgraphUrls } from '../config/networks';

let clientCache: Map<string, GraphQLClient> = new Map();

// Tracks chains that have been switched to fallback (Gateway) for this session
const fallbackActive: Set<number> = new Set();

function getClient(url: string): GraphQLClient {
  let client = clientCache.get(url);
  if (!client) {
    const headers: Record<string, string> = {};
    if (url.includes('gateway.thegraph.com') && process.env.GRAPH_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.GRAPH_API_KEY}`;
    }
    client = new GraphQLClient(url, { headers });
    clientCache.set(url, client);
  }
  return client;
}

function getFallbackUrl(chainId: number): string | undefined {
  const networkName = getNetworkNameByChainId(chainId);
  if (!networkName) return undefined;
  const envKey = `POP_${networkName.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase()}_SUBGRAPH_FALLBACK`;
  return process.env[envKey] || process.env[`POP_${networkName.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase()}_SUBGRAPH`];
}

function is429(error: any): boolean {
  const msg = error?.message || error?.response?.error || '';
  return msg.includes('429') || msg.includes('Too many requests');
}

/**
 * Query a subgraph on the specified chain.
 * Uses Studio (free) first, falls back to Gateway on 429.
 */
export async function query<T = any>(
  gqlQuery: string,
  variables?: Record<string, any>,
  chainId?: number
): Promise<T> {
  const config = resolveNetworkConfig(chainId);
  const effectiveChainId = config.chainId;

  // If already switched to fallback for this chain, use it directly
  if (fallbackActive.has(effectiveChainId)) {
    const fallbackUrl = getFallbackUrl(effectiveChainId);
    if (fallbackUrl) {
      return getClient(fallbackUrl).request<T>(gqlQuery, variables);
    }
  }

  // Try primary (Studio)
  try {
    return await getClient(config.resolvedSubgraph).request<T>(gqlQuery, variables);
  } catch (error: any) {
    if (!is429(error)) throw error;

    // 429 — switch to Gateway fallback
    const fallbackUrl = getFallbackUrl(effectiveChainId);
    if (!fallbackUrl) throw error; // no fallback configured

    fallbackActive.add(effectiveChainId);
    return getClient(fallbackUrl).request<T>(gqlQuery, variables);
  }
}

/**
 * Query a specific subgraph URL directly.
 */
export async function queryUrl<T = any>(
  url: string,
  gqlQuery: string,
  variables?: Record<string, any>
): Promise<T> {
  const client = getClient(url);
  return client.request<T>(gqlQuery, variables);
}

/**
 * Query all non-testnet subgraphs in parallel.
 * Returns results keyed by chainId.
 */
export async function queryAllChains<T = any>(
  gqlQuery: string,
  variables?: Record<string, any>
): Promise<Array<{ chainId: number; name: string; data: T | null }>> {
  const endpoints = getAllSubgraphUrls();

  const results = await Promise.allSettled(
    endpoints.map(async (ep) => {
      const data = await queryUrl<T>(ep.url, gqlQuery, variables);
      return { chainId: ep.chainId, name: ep.name, data };
    })
  );

  return results.map((result, i) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    return { chainId: endpoints[i].chainId, name: endpoints[i].name, data: null };
  });
}
