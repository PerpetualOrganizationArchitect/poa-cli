/**
 * pop subgraph — local subgraph cache management (task #459).
 *
 * Subcommands:
 *   pop subgraph cache list   — print cache entries with age + expiry
 *   pop subgraph cache clear  — wipe the cache file
 *   pop subgraph cache stats  — hit/miss/write counts for this process
 *
 * Cache lives at $POP_BRAIN_HOME/subgraph-cache.json. Per-agent local state.
 * Cache is read-through, populated automatically by `pop` commands that hit
 * the subgraph. This namespace is for inspection + maintenance only.
 */

import type { Argv, ArgumentsCamelCase } from 'yargs';
import { cacheList, cacheClear, cacheStats, getCachePath } from '../../lib/subgraph-cache';
import * as output from '../../lib/output';

export function registerSubgraphCommands(yargs: Argv) {
  return yargs
    .command(
      'cache <action>',
      'Local subgraph cache management (#459)',
      (sub: Argv) =>
        sub
          .command(
            'list',
            'List cache entries with age, TTL, expiry status',
            (y) => y,
            (_argv: ArgumentsCamelCase<{}>) => {
              const entries = cacheList();
              if (output.isJsonMode()) {
                output.json({
                  cachePath: getCachePath(),
                  entryCount: entries.length,
                  entries,
                });
                return;
              }
              if (entries.length === 0) {
                console.log('');
                console.log(`  Cache empty.  (path: ${getCachePath()})`);
                console.log('');
                return;
              }
              console.log('');
              console.log(`  Subgraph cache — ${entries.length} entries  (path: ${getCachePath()})`);
              console.log('  ' + '─'.repeat(80));
              for (const e of entries) {
                const ageMin = Math.floor(e.ageSec / 60);
                const ageStr = e.ageSec < 60 ? `${e.ageSec}s` : ageMin < 60 ? `${ageMin}m` : `${Math.floor(ageMin / 60)}h`;
                const ttlMin = Math.floor(e.ttlSec / 60);
                const ttlStr = e.ttlSec < 60 ? `${e.ttlSec}s` : ttlMin < 60 ? `${ttlMin}m` : `${Math.floor(ttlMin / 60)}h`;
                const status = e.expired ? 'EXPIRED' : 'fresh';
                console.log(`  ${e.queryName.padEnd(24)} age=${ageStr.padEnd(6)} ttl=${ttlStr.padEnd(6)} ${status}`);
              }
              console.log('');
            },
          )
          .command(
            'clear',
            'Wipe the cache file',
            (y) => y,
            (_argv: ArgumentsCamelCase<{}>) => {
              const r = cacheClear();
              if (output.isJsonMode()) {
                output.json({ entriesRemoved: r.entriesRemoved, cachePath: getCachePath() });
                return;
              }
              console.log('');
              console.log(`  Cache cleared. ${r.entriesRemoved} entries removed.`);
              console.log(`  Path: ${getCachePath()}`);
              console.log('');
            },
          )
          .command(
            'stats',
            'Print cache hit/miss/write counts for this process lifetime',
            (y) => y,
            (_argv: ArgumentsCamelCase<{}>) => {
              const s = cacheStats();
              const total = s.hits + s.misses;
              const hitRate = total === 0 ? 0 : (s.hits / total) * 100;
              if (output.isJsonMode()) {
                output.json({
                  ...s,
                  totalReads: total,
                  hitRatePct: Number(hitRate.toFixed(1)),
                });
                return;
              }
              console.log('');
              console.log('  Subgraph cache stats (this process lifetime)');
              console.log('  ' + '─'.repeat(50));
              console.log(`  hits:         ${s.hits}`);
              console.log(`  misses:       ${s.misses}`);
              console.log(`  writes:       ${s.writes}`);
              console.log(`  staleServed:  ${s.staleServed}  (served stale on dual-endpoint failure)`);
              console.log(`  hitRate:      ${hitRate.toFixed(1)}%  (of ${total} reads)`);
              console.log('');
            },
          )
          .demandCommand(1, 'Specify cache subcommand: list, clear, or stats'),
      () => {},
    )
    .demandCommand(1, 'Specify subgraph subcommand');
}
