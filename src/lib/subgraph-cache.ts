/**
 * Subgraph read-through cache (task #459) — addresses the 2026-04-17
 * GRAPH_API_KEY outage that blocked all on-chain agent activity for ~5h.
 *
 * Strategy: file-based cache at $POP_BRAIN_HOME/subgraph-cache.json.
 * Per-query TTL; check before Studio; write on success; serve stale-on-
 * dual-failure (when both Studio + Gateway are down).
 *
 * Per-agent local state — NO multi-agent shared cache (brain CRDT handles
 * the cross-agent comms case for the rare cross-agent shared lookup).
 *
 * Subgraph remains the source of truth. Cache is read-through only:
 * write operations (task create/submit/review, vote cast, etc.) go
 * through ethers/contracts and don't touch this cache.
 */

import { existsSync, readFileSync, writeFileSync, renameSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';

// ---------------------------------------------------------------------------
// Per-query TTL policy
// ---------------------------------------------------------------------------
//
// TTLs picked per the design draft. Rationale:
//   - Org metadata (name, address, modules) almost never changes — long TTL
//   - Members change on vouch — short TTL but tolerant
//   - Tasks/proposals change on every write — very short TTL
//   - Activity is near-realtime — minimal TTL
// Unknown queries default to no-cache (safe).

const TTL_BY_QUERY_NAME: Record<string, number> = {
  // Org-level static data — 24h
  GetOrgByName: 86400,
  FetchOrgById: 86400,        // observed name in src/lib/subgraph.ts callers
  GetOrgById: 86400,
  GetOrgModules: 86400,
  // Membership — 5min
  GetMembers: 300,
  FetchMembers: 300,
  // Task/proposal lists — 30s
  GetTasks: 30,
  GetProposals: 30,
  ListTasks: 30,
  ListProposals: 30,
  // Activity — 10s (near-realtime)
  GetActivity: 10,
  RecentActivity: 10,
  // Default: no cache. Anything not listed here is fetched fresh every time.
};

// In-memory hit/miss tracking for the lifetime of this process.
const stats = {
  hits: 0,
  misses: 0,
  staleServed: 0,
  writes: 0,
  // Silent-skip counter: cachePut was called with a named query that is
  // NOT in TTL_BY_QUERY_NAME. Surfaces policy-coverage gaps — queries
  // that ran against the subgraph but never made it into the cache.
  skippedWrites: 0,
  skippedQueryNames: {} as Record<string, number>,
};

// ---------------------------------------------------------------------------
// File path resolution
// ---------------------------------------------------------------------------

function getBrainHome(): string {
  const home = process.env.POP_BRAIN_HOME || join(homedir(), '.pop-agent', 'brain');
  if (!existsSync(home)) mkdirSync(home, { recursive: true });
  return home;
}

export function getCachePath(): string {
  return join(getBrainHome(), 'subgraph-cache.json');
}

// ---------------------------------------------------------------------------
// Schema + I/O
// ---------------------------------------------------------------------------

interface CacheEntry {
  result: any;
  fetchedAt: number;   // unix seconds
  ttlSec: number;
  queryName: string;   // for diagnostics
}

type CacheFile = Record<string, CacheEntry>;

function loadCache(): CacheFile {
  const path = getCachePath();
  if (!existsSync(path)) return {};
  try {
    const raw = readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    return parsed as CacheFile;
  } catch {
    // Corrupt file — return empty + log to stderr but don't crash.
    if (process.env.POP_BRAIN_DEBUG) {
      console.error(`[subgraph-cache] failed to parse ${path} — returning empty cache`);
    }
    return {};
  }
}

function saveCache(cache: CacheFile): void {
  const finalPath = getCachePath();
  const tmpPath = `${finalPath}.tmp.${process.pid}.${Date.now()}`;
  try {
    writeFileSync(tmpPath, JSON.stringify(cache, null, 2));
    renameSync(tmpPath, finalPath);
  } catch (err) {
    try { unlinkSync(tmpPath); } catch {}
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Cache key + query-name extraction
// ---------------------------------------------------------------------------

/**
 * Extract the operation name from a GraphQL query string. Returns null
 * if not present (anonymous query); such queries are not cached.
 *
 * Matches both 'query GetFoo(...)' and 'query GetFoo {...}' patterns,
 * tolerating leading whitespace / newlines.
 */
export function extractQueryName(gqlQuery: string): string | null {
  const match = gqlQuery.match(/^\s*query\s+([A-Za-z_][A-Za-z0-9_]*)/);
  return match ? match[1] : null;
}

/**
 * Compute the cache key for a query. SHA-1 over the canonical inputs:
 * chain id + query string + variables. Different variables = different key.
 */
export function cacheKey(chainId: number, gqlQuery: string, variables: any): string {
  const canonical = JSON.stringify({ c: chainId, q: gqlQuery, v: variables ?? null });
  return createHash('sha1').update(canonical).digest('hex');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface CacheGetOpts {
  /** When true, return cached entry even if expired. Used during dual-endpoint failure. */
  ignoreTtl?: boolean;
}

export function cacheGet<T = any>(
  chainId: number,
  gqlQuery: string,
  variables: any,
  opts?: CacheGetOpts,
): T | null {
  if (process.env.POP_SUBGRAPH_CACHE_DISABLE === '1') return null;
  const queryName = extractQueryName(gqlQuery);
  if (!queryName) return null; // anonymous queries not cached
  const key = cacheKey(chainId, gqlQuery, variables);
  const cache = loadCache();
  const entry = cache[key];
  if (!entry) {
    stats.misses += 1;
    return null;
  }
  const ageSec = Math.floor(Date.now() / 1000) - entry.fetchedAt;
  if (!opts?.ignoreTtl && ageSec > entry.ttlSec) {
    stats.misses += 1;
    return null;
  }
  if (opts?.ignoreTtl && ageSec > entry.ttlSec) {
    stats.staleServed += 1;
  } else {
    stats.hits += 1;
  }
  return entry.result as T;
}

export function cachePut(
  chainId: number,
  gqlQuery: string,
  variables: any,
  result: any,
): void {
  if (process.env.POP_SUBGRAPH_CACHE_DISABLE === '1') return;
  const queryName = extractQueryName(gqlQuery);
  if (!queryName) return; // not cacheable
  const ttlSec = TTL_BY_QUERY_NAME[queryName];
  if (!ttlSec) {
    stats.skippedWrites += 1;
    stats.skippedQueryNames[queryName] = (stats.skippedQueryNames[queryName] ?? 0) + 1;
    return;
  }
  const key = cacheKey(chainId, gqlQuery, variables);
  const cache = loadCache();
  cache[key] = {
    result,
    fetchedAt: Math.floor(Date.now() / 1000),
    ttlSec,
    queryName,
  };
  saveCache(cache);
  stats.writes += 1;
}

export interface CacheStats {
  hits: number;
  misses: number;
  staleServed: number;
  writes: number;
  skippedWrites: number;
  skippedQueryNames: Record<string, number>;
}

export function cacheStats(): CacheStats {
  return {
    hits: stats.hits,
    misses: stats.misses,
    staleServed: stats.staleServed,
    writes: stats.writes,
    skippedWrites: stats.skippedWrites,
    skippedQueryNames: { ...stats.skippedQueryNames },
  };
}

export interface CacheFileStats {
  entryCount: number;
  fileBytes: number;
  freshCount: number;
  expiredCount: number;
  oldestAgeSec: number | null;
  newestAgeSec: number | null;
  byQueryName: Record<string, number>;
}

/**
 * HB#320 (vigil, Step 2.8 Q2 follow-up): runtime stats from cacheStats()
 * reset on every process start, so `pop subgraph cache stats` shows
 * hitRate 0% unless the CLI has served requests in the current process
 * — confusing for operators inspecting a populated cache from a fresh
 * CLI invocation. This helper complements runtime stats with
 * file-derived persistent signal: how many entries exist, how big, how
 * stale, by query type. No mutations, pure read.
 */
export function cacheFileStats(): CacheFileStats {
  const cache = loadCache();
  const now = Math.floor(Date.now() / 1000);
  const entries = Object.values(cache);
  const byQueryName: Record<string, number> = {};
  let freshCount = 0;
  let expiredCount = 0;
  let oldestFetchedAt = Infinity;
  let newestFetchedAt = -Infinity;

  for (const entry of entries) {
    byQueryName[entry.queryName] = (byQueryName[entry.queryName] ?? 0) + 1;
    if (now - entry.fetchedAt > entry.ttlSec) expiredCount += 1;
    else freshCount += 1;
    if (entry.fetchedAt < oldestFetchedAt) oldestFetchedAt = entry.fetchedAt;
    if (entry.fetchedAt > newestFetchedAt) newestFetchedAt = entry.fetchedAt;
  }

  let fileBytes = 0;
  try {
    const path = getCachePath();
    if (existsSync(path)) {
      fileBytes = require('fs').statSync(path).size;
    }
  } catch {}

  return {
    entryCount: entries.length,
    fileBytes,
    freshCount,
    expiredCount,
    oldestAgeSec: oldestFetchedAt === Infinity ? null : now - oldestFetchedAt,
    newestAgeSec: newestFetchedAt === -Infinity ? null : now - newestFetchedAt,
    byQueryName,
  };
}

export function cacheClear(): { entriesRemoved: number } {
  const cache = loadCache();
  const count = Object.keys(cache).length;
  saveCache({});
  return { entriesRemoved: count };
}

export interface CacheListEntry {
  key: string;
  queryName: string;
  fetchedAt: number;
  ttlSec: number;
  ageSec: number;
  expired: boolean;
}

export function cacheList(): CacheListEntry[] {
  const cache = loadCache();
  const now = Math.floor(Date.now() / 1000);
  return Object.entries(cache).map(([key, entry]) => ({
    key,
    queryName: entry.queryName,
    fetchedAt: entry.fetchedAt,
    ttlSec: entry.ttlSec,
    ageSec: now - entry.fetchedAt,
    expired: now - entry.fetchedAt > entry.ttlSec,
  }));
}

/** For tests: allow overriding the TTL policy at runtime. */
export function _setTtlForTesting(queryName: string, ttlSec: number): void {
  TTL_BY_QUERY_NAME[queryName] = ttlSec;
}

/** For tests: reset in-memory stats counters. */
export function _resetStatsForTesting(): void {
  stats.hits = 0;
  stats.misses = 0;
  stats.staleServed = 0;
  stats.writes = 0;
  stats.skippedWrites = 0;
  stats.skippedQueryNames = {};
}
