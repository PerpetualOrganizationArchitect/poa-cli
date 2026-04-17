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
import { cacheGet, cachePut } from './subgraph-cache';

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

// Exported for unit testing — pure helpers, no side effects.
export function is429(error: any): boolean {
  const msg = error?.message || error?.response?.error || '';
  return msg.includes('429') || msg.includes('Too many requests');
}

/**
 * Task #447-adjacent resilience (HB#297): Gateway returns "payment required"
 * when the GRAPH_API_KEY is exhausted (quota or billing). This is distinct
 * from 429 rate-limit; the Gateway itself is not overloaded, the auth is
 * the problem. When this happens AND we're on the Gateway fallback, we
 * should give Primary (Studio) another try — its rate-limit may have
 * reset while we were bouncing off Gateway.
 */
export function isPaymentRequired(error: any): boolean {
  const msg = error?.message || error?.response?.error || '';
  return msg.includes('payment required');
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

  // Task #459: read-through cache. Check cache before any network hit.
  // Cache only kicks in for queries listed in subgraph-cache.ts TTL policy
  // (org-level, members, tasks, etc); unknown queries pass through.
  const cached = cacheGet<T>(effectiveChainId, gqlQuery, variables);
  if (cached !== null) return cached;

  // If already switched to fallback for this chain, use it directly.
  // HB#297: on Gateway "payment required" (GRAPH_API_KEY exhausted), give
  // Primary (Studio) one more shot — its rate-limit may have reset in the
  // interval. If Primary still 429s, the original fallback error bubbles.
  if (fallbackActive.has(effectiveChainId)) {
    const fallbackUrl = getFallbackUrl(effectiveChainId);
    if (fallbackUrl) {
      try {
        const result = await getClient(fallbackUrl).request<T>(gqlQuery, variables);
        cachePut(effectiveChainId, gqlQuery, variables, result);
        return result;
      } catch (error: any) {
        if (!isPaymentRequired(error)) throw error;
        // Gateway payment-required — retry Primary once before surfacing.
        try {
          const result = await getClient(config.resolvedSubgraph).request<T>(gqlQuery, variables);
          // Primary recovered — exit fallback mode so future calls use it first.
          fallbackActive.delete(effectiveChainId);
          cachePut(effectiveChainId, gqlQuery, variables, result);
          return result;
        } catch (retryErr: any) {
          // Both down. Try stale cache before giving up (task #459).
          if (process.env.POP_SUBGRAPH_CACHE_STALE_ON_ERROR !== '0') {
            const stale = cacheGet<T>(effectiveChainId, gqlQuery, variables, { ignoreTtl: true });
            if (stale !== null) {
              console.error(`[subgraph] both endpoints down — serving stale cache for ${gqlQuery.slice(0, 60).replace(/\s+/g, ' ')}`);
              return stale;
            }
          }
          // Surface the more informative of the two.
          throw isPaymentRequired(retryErr) || is429(retryErr) ? error : retryErr;
        }
      }
    }
  }

  // Try primary (Studio)
  try {
    const result = await getClient(config.resolvedSubgraph).request<T>(gqlQuery, variables);
    cachePut(effectiveChainId, gqlQuery, variables, result);
    return result;
  } catch (error: any) {
    if (!is429(error)) throw error;

    // 429 — switch to Gateway fallback
    const fallbackUrl = getFallbackUrl(effectiveChainId);
    if (!fallbackUrl) throw error; // no fallback configured

    fallbackActive.add(effectiveChainId);
    try {
      const result = await getClient(fallbackUrl).request<T>(gqlQuery, variables);
      cachePut(effectiveChainId, gqlQuery, variables, result);
      return result;
    } catch (fbErr: any) {
      // Both endpoints down. Try stale cache before surfacing the error
      // (task #459 — addresses the 2026-04-17 5h outage).
      if (isPaymentRequired(fbErr) || is429(fbErr)) {
        if (process.env.POP_SUBGRAPH_CACHE_STALE_ON_ERROR !== '0') {
          const stale = cacheGet<T>(effectiveChainId, gqlQuery, variables, { ignoreTtl: true });
          if (stale !== null) {
            console.error(`[subgraph] both endpoints down — serving stale cache for ${gqlQuery.slice(0, 60).replace(/\s+/g, ' ')}`);
            return stale;
          }
        }
      }
      // HB#297: Gateway also broken (payment required). Surface the
      // specific outage class to the operator — generic 'request failed'
      // hides whether it's infra or code. Caller can then decide whether
      // to retry, wait, or pivot to subgraph-independent paths (brain
      // layer, git).
      if (isPaymentRequired(fbErr)) {
        throw new Error(
          `Both subgraphs are down: Primary (Studio) rate-limited (429) AND Fallback (Gateway) payment-required. ` +
          `Wait for rate-limit reset OR rotate GRAPH_API_KEY. ` +
          `For subgraph-independent work, use 'pop brain' commands or direct git. ` +
          `(Original Primary err: ${error.message?.slice(0, 120)})`
        );
      }
      throw fbErr;
    }
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
