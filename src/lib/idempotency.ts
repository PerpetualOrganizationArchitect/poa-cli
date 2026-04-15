/**
 * Idempotency cache for on-chain write commands — task #369 (HB#213).
 *
 * The HB#211 failure mode: vigil_01 created duplicate on-chain proposals
 * #55 and #56 for the same PR #14 merge because the first `pop vote create`
 * ran via background task, the output file was initially empty, and a
 * retry ran before the first call had completed. Both succeeded; both
 * expired with 0 votes; HB#212 had to announce both to clear state. See
 * brain lesson `background-retry-duplicate-on-chain-writes-hb-211-...`.
 *
 * Fix: a small file-backed cache that sits between the CLI's argument
 * parse and the actual `executeTx` call. When a write command runs, it:
 *
 *   1. Computes a deterministic cache key from { orgId, commandName,
 *      idempotencyKey } where idempotencyKey is either (a) passed
 *      explicitly via `--idempotency-key <str>` or (b) auto-derived
 *      from hash(JSON-serialized argv minus transient fields like
 *      --private-key, --dry-run, --yes).
 *   2. Checks the cache for a non-expired entry. TTL = 15 minutes —
 *      enough for any reasonable retry, short enough that intentional
 *      duplicates 16+ minutes later are treated as new writes.
 *   3. If a cache hit: returns the prior result without re-submitting
 *      the transaction. Caller prints the cached fields and exits 0.
 *   4. If no cache hit: caller submits the tx; on success, caller
 *      writes the fresh entry via `recordIdempotentResult`.
 *
 * The cache lives at `$POP_AGENT_HOME/idempotency-cache.json` where
 * POP_AGENT_HOME defaults to `~/.pop-agent`. Each agent home has its
 * own cache so argus / vigil / sentinel don't collide.
 *
 * Explicit bypass via `--no-idempotency` skips the check entirely.
 * Out of scope: read operations (reads are safe to retry), brain
 * writes (different dispatch layer), treasury operations (different
 * invariants). This module is for pop vote create + pop task create
 * in the first ship; follow-up tasks extend it.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createHash } from 'crypto';

const TTL_SECONDS = 15 * 60; // 15 minutes — see module header

/**
 * On-disk cache shape. Not exported — callers use the functions below.
 */
interface CacheFile {
  version: 1;
  entries: Record<string, CacheEntry>;
}

interface CacheEntry {
  /** When this entry was written, unix-seconds. Used for TTL eviction. */
  ts: number;
  /** The original cache-key-components, for audit purposes. */
  orgId: string;
  command: string;
  /** Result captured when the write succeeded. Shape is whatever the
   *  caller wants to remember — typically { txHash, proposalId } or
   *  { txHash, taskId, ipfsCid }. Free-form so we can reuse for new
   *  commands without schema migrations. */
  result: Record<string, any>;
}

/**
 * Where the cache file lives. Respects POP_AGENT_HOME env var so
 * multi-agent setups (argus / vigil / sentinel) each have their own.
 */
function getCachePath(): string {
  const agentHome = process.env.POP_AGENT_HOME || path.join(os.homedir(), '.pop-agent');
  return path.join(agentHome, 'idempotency-cache.json');
}

/**
 * Load the cache file. Returns a fresh empty cache if the file does
 * not exist or is corrupt — corruption is a silent recovery case
 * because losing a 15-minute cache is strictly less bad than crashing
 * a legitimate write.
 */
function loadCache(): CacheFile {
  const p = getCachePath();
  try {
    if (!fs.existsSync(p)) return { version: 1, entries: {} };
    const raw = fs.readFileSync(p, 'utf8');
    const parsed = JSON.parse(raw) as CacheFile;
    if (parsed && parsed.version === 1 && parsed.entries) return parsed;
    return { version: 1, entries: {} };
  } catch {
    return { version: 1, entries: {} };
  }
}

function saveCache(cache: CacheFile): void {
  const p = getCachePath();
  try {
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(p, JSON.stringify(cache, null, 2), { mode: 0o600 });
  } catch {
    // Best-effort. If we can't save, the next call may duplicate — but
    // that's the same as pre-#369 behavior. Don't crash the write.
  }
}

/**
 * Compute the deterministic cache key from the caller's components.
 *
 * Explicit-key callers pass their `--idempotency-key` value directly.
 * Auto-key callers pass a stable JSON-serialized view of their argv
 * (with transient fields stripped — see stripTransient below) and
 * this function hashes it.
 */
export function computeCacheKey(
  orgId: string,
  commandName: string,
  idempotencyKey: string,
): string {
  const digest = createHash('sha256')
    .update(`${orgId}\0${commandName}\0${idempotencyKey}`)
    .digest('hex')
    .slice(0, 32);
  return `${commandName}:${digest}`;
}

/**
 * Strip transient argv fields that shouldn't affect the auto-derived
 * idempotency key. `--private-key` changes per agent session but
 * should not fork two separate cache entries. `--dry-run` and `--yes`
 * are UX flags, not content. Same for `--json` (output format) and
 * `--verbose` (diagnostics).
 */
const TRANSIENT_ARGV_KEYS = new Set([
  'privateKey',
  'private-key',
  'dryRun',
  'dry-run',
  'yes',
  'y',
  'json',
  'verbose',
  'v',
  'help',
  'version',
  '_',
  '$0',
  'idempotencyKey',
  'idempotency-key',
  'noIdempotency',
  'no-idempotency',
]);

/**
 * Normalize argv into a stable JSON string for auto-key derivation.
 * Keys are sorted so two calls with the same content but different
 * argument order hash to the same key.
 */
export function argvToIdempotencyString(argv: Record<string, any>): string {
  const filtered: Record<string, any> = {};
  for (const [k, v] of Object.entries(argv)) {
    if (TRANSIENT_ARGV_KEYS.has(k)) continue;
    if (typeof v === 'function') continue;
    if (v === undefined) continue;
    filtered[k] = v;
  }
  // Sort keys for determinism
  const sortedKeys = Object.keys(filtered).sort();
  const obj: Record<string, any> = {};
  for (const k of sortedKeys) obj[k] = filtered[k];
  return JSON.stringify(obj);
}

/**
 * Check whether an idempotent result already exists for this call.
 * Returns the cached result (unwrapped) on hit, or null on miss.
 * Expired entries (older than TTL) are treated as misses and pruned.
 */
export function checkIdempotencyCache(
  orgId: string,
  commandName: string,
  idempotencyKey: string,
): Record<string, any> | null {
  const cacheKey = computeCacheKey(orgId, commandName, idempotencyKey);
  const cache = loadCache();
  const entry = cache.entries[cacheKey];
  if (!entry) return null;
  const nowSecs = Math.floor(Date.now() / 1000);
  if (nowSecs - entry.ts > TTL_SECONDS) {
    // Expired — prune silently so the cache file doesn't accumulate
    delete cache.entries[cacheKey];
    saveCache(cache);
    return null;
  }
  return entry.result;
}

/**
 * Record a successful write result for later idempotency checks.
 * Also prunes any expired entries at the same time to keep the cache
 * from growing unboundedly.
 */
export function recordIdempotentResult(
  orgId: string,
  commandName: string,
  idempotencyKey: string,
  result: Record<string, any>,
): void {
  const cacheKey = computeCacheKey(orgId, commandName, idempotencyKey);
  const cache = loadCache();
  const nowSecs = Math.floor(Date.now() / 1000);

  // Prune expired entries while we have the file open
  for (const [k, e] of Object.entries(cache.entries)) {
    if (nowSecs - e.ts > TTL_SECONDS) delete cache.entries[k];
  }

  cache.entries[cacheKey] = {
    ts: nowSecs,
    orgId,
    command: commandName,
    result,
  };
  saveCache(cache);
}

/**
 * Test-only hook: clear the cache file. Useful for vitest setup/teardown.
 * Not exported from the main barrel — callers import it explicitly.
 */
export function _clearIdempotencyCacheForTest(): void {
  const p = getCachePath();
  try {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch {
    // Best-effort
  }
}
