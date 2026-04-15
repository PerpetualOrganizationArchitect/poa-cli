/**
 * No-Allocation Cache
 *
 * Tracks which distributions a given address has been verified to have
 * no allocation in. Prevents triage from flagging the same distribution
 * as "unclaimed" every heartbeat when the agent isn't actually eligible.
 *
 * Storage: ~/.pop-agent/brain/Memory/no-alloc-cache.json
 * Shape:
 *   {
 *     "<address>": {
 *       "<orgId>-<distributionId>": <timestamp>
 *     }
 *   }
 *
 * Entries never expire — once a distribution's merkle root is set,
 * eligibility is fixed. New distributions always get checked.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

const CACHE_PATH = join(homedir(), '.pop-agent', 'brain', 'Memory', 'no-alloc-cache.json');

type Cache = Record<string, Record<string, number>>;

function load(): Cache {
  if (!existsSync(CACHE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CACHE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function save(cache: Cache): void {
  try {
    const dir = dirname(CACHE_PATH);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  } catch {
    // Non-fatal — cache is a performance optimization
  }
}

/**
 * Record that `address` has no allocation in a given distribution.
 * Subsequent triage runs will skip this distribution for this address.
 */
export function markNoAllocation(address: string, orgId: string, distributionId: string): void {
  const cache = load();
  const addrKey = address.toLowerCase();
  const distKey = `${orgId.toLowerCase()}-${distributionId}`;
  if (!cache[addrKey]) cache[addrKey] = {};
  cache[addrKey][distKey] = Date.now();
  save(cache);
}

/**
 * Check whether `address` is known to have no allocation in the given distribution.
 */
export function hasKnownNoAllocation(address: string, orgId: string, distributionId: string): boolean {
  const cache = load();
  const addrKey = address.toLowerCase();
  const distKey = `${orgId.toLowerCase()}-${distributionId}`;
  return !!cache[addrKey]?.[distKey];
}

/**
 * Get all distribution keys known to have no allocation for `address`.
 * Returns a Set of "<orgId>-<distributionId>" keys.
 */
export function getNoAllocationSet(address: string): Set<string> {
  const cache = load();
  const addrKey = address.toLowerCase();
  return new Set(Object.keys(cache[addrKey] || {}));
}
