/**
 * Subgraph Client
 * Lightweight GraphQL client for querying The Graph subgraphs.
 */

import { GraphQLClient } from 'graphql-request';
import { resolveNetworkConfig, getAllSubgraphUrls } from '../config/networks';

let clientCache: Map<string, GraphQLClient> = new Map();

function getClient(url: string): GraphQLClient {
  let client = clientCache.get(url);
  if (!client) {
    client = new GraphQLClient(url);
    clientCache.set(url, client);
  }
  return client;
}

/**
 * Query a subgraph on the specified chain.
 */
export async function query<T = any>(
  gqlQuery: string,
  variables?: Record<string, any>,
  chainId?: number
): Promise<T> {
  const config = resolveNetworkConfig(chainId);
  const client = getClient(config.resolvedSubgraph);
  return client.request<T>(gqlQuery, variables);
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
