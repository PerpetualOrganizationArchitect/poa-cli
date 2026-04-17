/**
 * pop agent session-start — bootstrap stitcher (task #464, sentinel retro-542 change-1).
 *
 * Stitches #443 (daemon-check) + #447 (stable ports) + #448 (peer registry) +
 * #459 (subgraph cache) into one bootstrap. Wired into heartbeat Step 0.
 *
 * Eliminates two recurring failure classes:
 *   - dark-peer regression (HB#504): daemon never started, agent's writes
 *     live only in local state, peers see nothing
 *   - subgraph-outage-blocking (HB#524): no cached org metadata, every
 *     read command bricks until subgraph recovers
 *
 * Composition only — no new logic. Reuses existing exports from brain/daemon
 * + brain-daemon lib + subgraph-cache lib.
 */

import type { Argv, ArgumentsCamelCase } from 'yargs';
import { spawn } from 'child_process';
import {
  getRunningDaemonPid,
  getDaemonPidPath,
  getDaemonSockPath,
  sendIpcRequest,
} from '../../lib/brain-daemon';
import { cacheList, cacheStats, getCachePath } from '../../lib/subgraph-cache';
import { readBrainDoc, stopBrainNode } from '../../lib/brain';
import { query as subgraphQuery } from '../../lib/subgraph';
import * as output from '../../lib/output';

interface SessionStartArgs {
  json?: boolean;
  'skip-cache-warmup'?: boolean;
  'skip-peer-refresh'?: boolean;
  'daemon-wait-ms'?: number;
}

interface DaemonReport {
  status: 'running' | 'started' | 'failed';
  pid: number | null;
  connections: number;
  knownPeerCount: number;
  topics: number;
  uptimeSec: number;
  warning?: string;
}

interface CacheReport {
  status: 'fresh' | 'warmed' | 'skipped' | 'unavailable';
  entries: number;
  cachePath: string;
  warning?: string;
}

interface PeerRegistryReport {
  status: 'fresh' | 'stale' | 'empty' | 'skipped' | 'unavailable';
  peerCount: number;
  oldestAgeSec: number | null;
  warning?: string;
}

interface SessionStartReport {
  ok: boolean;
  daemon: DaemonReport;
  cache: CacheReport;
  peers: PeerRegistryReport;
  durationMs: number;
}

const PEER_REGISTRY_STALE_SEC = 5 * 60;

async function ensureDaemon(waitMs: number): Promise<DaemonReport> {
  const existingPid = getRunningDaemonPid();
  if (existingPid !== null) {
    try {
      const status = await sendIpcRequest('status', {}, 3000);
      return {
        status: 'running',
        pid: existingPid,
        connections: status.connections ?? 0,
        knownPeerCount: status.knownPeerCount ?? 0,
        topics: (status.topics ?? []).length,
        uptimeSec: status.uptime ?? 0,
        warning: (status.connections ?? 0) === 0 ? 'daemon up but connections=0 — peers unreachable' : undefined,
      };
    } catch (err: any) {
      return {
        status: 'failed',
        pid: existingPid,
        connections: 0, knownPeerCount: 0, topics: 0, uptimeSec: 0,
        warning: `daemon pid ${existingPid} but IPC failed: ${err.message}`,
      };
    }
  }
  // Spawn detached daemon (matches handleStart from src/commands/brain/daemon.ts)
  const child = spawn(process.execPath, [process.argv[1], 'brain', 'daemon', '__run'], {
    detached: true, stdio: 'ignore',
  });
  child.unref();
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 250));
    const pid = getRunningDaemonPid();
    if (pid !== null) {
      try {
        const status = await sendIpcRequest('status', {}, 3000);
        return {
          status: 'started',
          pid,
          connections: status.connections ?? 0,
          knownPeerCount: status.knownPeerCount ?? 0,
          topics: (status.topics ?? []).length,
          uptimeSec: status.uptime ?? 0,
          warning: (status.connections ?? 0) === 0 ? 'daemon just started — peers may take 30-60s to dial' : undefined,
        };
      } catch {
        // socket not yet listening — keep polling
      }
    }
  }
  return {
    status: 'failed',
    pid: null,
    connections: 0, knownPeerCount: 0, topics: 0, uptimeSec: 0,
    warning: `daemon did not come up within ${waitMs}ms`,
  };
}

const ORG_WARMUP_QUERY = `
  query GetOrgByName($name: String!) {
    organizations(where: { name: $name }) { id name participationToken { totalSupply } }
  }
`;

async function warmupSubgraphCache(skip: boolean): Promise<CacheReport> {
  const cachePath = getCachePath();
  if (skip) {
    const list = cacheList();
    return { status: 'skipped', entries: list.length, cachePath };
  }
  const orgName = process.env.POP_DEFAULT_ORG;
  if (!orgName) {
    const list = cacheList();
    return { status: 'skipped', entries: list.length, cachePath, warning: 'POP_DEFAULT_ORG not set; nothing to warm' };
  }
  // If org name looks like a hex id, GetOrgByName won't help — skip
  if (orgName.startsWith('0x')) {
    const list = cacheList();
    return { status: 'skipped', entries: list.length, cachePath, warning: 'POP_DEFAULT_ORG is hex id, GetOrgByName not applicable' };
  }
  try {
    await subgraphQuery(ORG_WARMUP_QUERY, { name: orgName });
    const list = cacheList();
    return { status: 'warmed', entries: list.length, cachePath };
  } catch (err: any) {
    const list = cacheList();
    const isOutage = err.message?.includes('429') || err.message?.includes('payment required') || err.message?.includes('Both subgraphs');
    return {
      status: 'unavailable',
      entries: list.length,
      cachePath,
      warning: isOutage ? `subgraph outage — cache will serve stale on next read` : `warmup failed: ${err.message?.slice(0, 100)}`,
    };
  }
}

async function checkPeerRegistry(skip: boolean): Promise<PeerRegistryReport> {
  if (skip) {
    return { status: 'skipped', peerCount: 0, oldestAgeSec: null };
  }
  try {
    const handle = await readBrainDoc('pop.brain.peers');
    const doc = handle.doc;
    const peers = doc?.peers ?? {};
    const peerIds = Object.keys(peers);
    if (peerIds.length === 0) {
      return { status: 'empty', peerCount: 0, oldestAgeSec: null, warning: 'no peers in registry — Stage 2/3 of #448 may not be live yet' };
    }
    const now = Math.floor(Date.now() / 1000);
    let oldest = 0;
    for (const id of peerIds) {
      const lastSeen = peers[id]?.lastSeen ?? 0;
      const age = now - lastSeen;
      if (age > oldest) oldest = age;
    }
    return {
      status: oldest > PEER_REGISTRY_STALE_SEC ? 'stale' : 'fresh',
      peerCount: peerIds.length,
      oldestAgeSec: oldest,
      warning: oldest > PEER_REGISTRY_STALE_SEC ? `oldest peer entry ${oldest}s — daemon-side refresh may be lagging` : undefined,
    };
  } catch (err: any) {
    return {
      status: 'unavailable',
      peerCount: 0, oldestAgeSec: null,
      warning: `peer registry read failed: ${err.message?.slice(0, 80)}`,
    };
  } finally {
    try { await stopBrainNode(); } catch {}
  }
}

async function sessionStartHandler(argv: ArgumentsCamelCase<SessionStartArgs>): Promise<void> {
  const start = Date.now();
  const waitMs = argv['daemon-wait-ms'] ?? 5000;

  const daemon = await ensureDaemon(waitMs);
  const cache = await warmupSubgraphCache(!!argv['skip-cache-warmup']);
  const peers = await checkPeerRegistry(!!argv['skip-peer-refresh']);

  const ok = daemon.status !== 'failed';
  const report: SessionStartReport = {
    ok,
    daemon,
    cache,
    peers,
    durationMs: Date.now() - start,
  };

  if (output.isJsonMode()) {
    output.json(report);
  } else {
    console.log('');
    console.log(`  Session start  (${report.durationMs}ms)`);
    console.log('  ' + '─'.repeat(60));
    console.log(`  daemon:    ${daemon.status.padEnd(10)} pid=${daemon.pid ?? '-'}  conns=${daemon.connections}  peers=${daemon.knownPeerCount}  topics=${daemon.topics}`);
    if (daemon.warning) console.log(`             ⚠ ${daemon.warning}`);
    console.log(`  cache:     ${cache.status.padEnd(10)} entries=${cache.entries}`);
    if (cache.warning) console.log(`             ⚠ ${cache.warning}`);
    console.log(`  peers:     ${peers.status.padEnd(10)} count=${peers.peerCount}${peers.oldestAgeSec !== null ? `  oldest=${peers.oldestAgeSec}s` : ''}`);
    if (peers.warning) console.log(`             ⚠ ${peers.warning}`);
    console.log('');
    if (!ok) console.log(`  ✗ Session start CRITICAL: daemon failed. Brain writes will not propagate.`);
    else console.log(`  ✓ Session ready.`);
    console.log('');
  }

  if (!ok) process.exit(1);
}

export const sessionStartHandler_export = {
  builder: (yargs: Argv) =>
    yargs
      .option('skip-cache-warmup', {
        type: 'boolean', default: false,
        describe: 'Skip subgraph cache warmup (use on offline starts)',
      })
      .option('skip-peer-refresh', {
        type: 'boolean', default: false,
        describe: 'Skip peer registry freshness check',
      })
      .option('daemon-wait-ms', {
        type: 'number', default: 5000,
        describe: 'Max ms to wait for daemon socket after spawn',
      }),
  handler: sessionStartHandler,
};
