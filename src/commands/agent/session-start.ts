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
  CANONICAL_BRAIN_DOCS,
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

export interface DaemonReport {
  status: 'running' | 'started' | 'failed';
  pid: number | null;
  connections: number;
  knownPeerCount: number;
  topics: number;
  uptimeSec: number;
  /** HB#348: list of CANONICAL_BRAIN_DOCS the running daemon is NOT subscribed to. Empty = OK. */
  missingCanonicalSubs: string[];
  warning?: string;
}

interface CacheReport {
  status: 'fresh' | 'warmed' | 'skipped' | 'unavailable';
  entries: number;
  cachePath: string;
  warning?: string;
}

export interface PeerRegistryReport {
  status: 'fresh' | 'stale' | 'empty' | 'skipped' | 'unavailable';
  peerCount: number;
  oldestAgeSec: number | null;
  warning?: string;
}

/**
 * HB#577 (retro-344 change-4): fleet-state diagnostic.
 * Distinguishes self-dark (I'm alone / first agent) from fleet-dark
 * (peers published but unreachable) from partial (some up, some down)
 * from healthy (all published peers reachable). Addresses the HB#564
 * brain lesson: 'daemon-check detects self-dark but not fleet-dark'.
 */
type FleetState = 'isolated' | 'fleet-dark' | 'partial' | 'healthy' | 'unknown';

export interface FleetReport {
  state: FleetState;
  /** Registry peer count excluding my own entry (count of potential peers to dial). */
  otherPeersInRegistry: number;
  /** Current live connections per daemon IPC. */
  connections: number;
  /** Optional diagnostic hint for the operator. */
  hint?: string;
}

/**
 * HB#618 (per brain lesson bafkreic5ufg6bn2aqwclh7iz6kxp5wyi2g5v4z7ispnlemxg7yiqaowroq):
 * session-start git-status check catches the HB#520 loss-risk pattern
 * (untracked production files sitting in working tree across sessions).
 */
export interface UntrackedReport {
  status: 'clean' | 'some' | 'loss-risk' | 'unavailable';
  /** Count of untracked files under src/ (production code). */
  untrackedSrcCount: number;
  /** Sample of up to 3 untracked src/ paths (for quick operator glance). */
  samplePaths: string[];
  warning?: string;
}

interface SessionStartReport {
  ok: boolean;
  daemon: DaemonReport;
  cache: CacheReport;
  peers: PeerRegistryReport;
  fleet: FleetReport;
  untracked: UntrackedReport;
  durationMs: number;
}

const PEER_REGISTRY_STALE_SEC = 5 * 60;
const UNTRACKED_SRC_LOSS_RISK_THRESHOLD = 5;

/**
 * Classify fleet state from daemon + registry reports.
 * No new I/O — pure derivation from already-collected data.
 * Exported for unit testing (retro-344 change-5 coverage bump, HB#348).
 */
export function computeFleetState(daemon: DaemonReport, peers: PeerRegistryReport): FleetReport {
  const connections = daemon.connections;
  // peers.peerCount includes my own entry (daemon publishes it on startup).
  // Subtract 1 to get "other agents that have registered."
  const otherPeersInRegistry = Math.max(peers.peerCount - 1, 0);

  if (peers.status === 'skipped' || peers.status === 'unavailable') {
    return {
      state: 'unknown',
      otherPeersInRegistry,
      connections,
      hint: `registry check ${peers.status} — cannot classify fleet state`,
    };
  }

  if (otherPeersInRegistry === 0) {
    return {
      state: 'isolated',
      otherPeersInRegistry,
      connections,
      hint: connections === 0
        ? 'no other agents in registry — first agent or all others never published. Writes persist locally, will sync on peer arrival.'
        : connections > 0
          ? `connected to ${connections} peer(s) but registry shows none — pop.brain.peers not yet synced from them. Will stabilize once their registry entry propagates.`
          : undefined,
    };
  }

  if (connections === 0) {
    return {
      state: 'fleet-dark',
      otherPeersInRegistry,
      connections,
      hint: `${otherPeersInRegistry} peer(s) registered but 0 reachable — their daemons may be down. Not a self-dark issue (my daemon up). Writes persist locally until fleet reconnects.`,
    };
  }

  if (connections < otherPeersInRegistry) {
    return {
      state: 'partial',
      otherPeersInRegistry,
      connections,
      hint: `connected to ${connections} of ${otherPeersInRegistry} registered peer(s). Some fleet members dark or blocked — partial propagation only.`,
    };
  }

  // connections >= otherPeersInRegistry → healthy (may exceed if public bootstrap peers counted)
  return { state: 'healthy', otherPeersInRegistry, connections };
}

async function ensureDaemon(waitMs: number): Promise<DaemonReport> {
  const existingPid = getRunningDaemonPid();
  if (existingPid !== null) {
    try {
      const status = await sendIpcRequest('status', {}, 3000);
      const subscribedDocs = (status.subscribedDocs ?? []) as string[];
      const missingCanonicalSubs = CANONICAL_BRAIN_DOCS.filter((doc) => !subscribedDocs.includes(doc));
      const driftWarning = missingCanonicalSubs.length > 0
        ? `daemon (uptime ${Math.floor((status.uptime ?? 0) / 3600)}h) missing ${missingCanonicalSubs.length} canonical subscription(s): ${missingCanonicalSubs.join(', ')} — restart needed (pop brain daemon stop && pop brain daemon start)`
        : undefined;
      const connWarning = (status.connections ?? 0) === 0 ? 'daemon up but connections=0 — peers unreachable' : undefined;
      return {
        status: 'running',
        pid: existingPid,
        connections: status.connections ?? 0,
        knownPeerCount: status.knownPeerCount ?? 0,
        topics: (status.topics ?? []).length,
        uptimeSec: status.uptime ?? 0,
        missingCanonicalSubs,
        warning: driftWarning ?? connWarning,
      };
    } catch (err: any) {
      return {
        status: 'failed',
        pid: existingPid,
        connections: 0, knownPeerCount: 0, topics: 0, uptimeSec: 0,
        missingCanonicalSubs: [],
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
          missingCanonicalSubs: [],  // freshly started — subscribes to all CANONICAL_BRAIN_DOCS by definition
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
    missingCanonicalSubs: [],
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

/**
 * Scan `git status --short` for untracked files under src/. Threshold-based
 * loss-risk warning per HB#617 brain lesson. Quick + local + no-network.
 */
export function checkUntrackedFiles(
  gitStatusOutput: string,
  threshold: number = UNTRACKED_SRC_LOSS_RISK_THRESHOLD,
): UntrackedReport {
  // `git status --short` format: 2 chars status + 1 space + path.
  // Untracked lines start with '??'.
  const lines = gitStatusOutput.split('\n');
  const untrackedSrc: string[] = [];
  for (const line of lines) {
    if (!line.startsWith('?? ')) continue;
    const path = line.slice(3).trim();
    // Production-code gate — only src/ files count. Exclude .generated, test/, etc.
    if (path.startsWith('src/') && !path.includes('.generated.')) {
      untrackedSrc.push(path);
    }
  }

  if (untrackedSrc.length === 0) {
    return { status: 'clean', untrackedSrcCount: 0, samplePaths: [] };
  }

  const samplePaths = untrackedSrc.slice(0, 3);
  if (untrackedSrc.length >= threshold) {
    return {
      status: 'loss-risk',
      untrackedSrcCount: untrackedSrc.length,
      samplePaths,
      warning: `${untrackedSrc.length} untracked src/ files — loss-risk per HB#617. If authored, commit; else rm. Sample: ${samplePaths.join(', ')}`,
    };
  }
  return {
    status: 'some',
    untrackedSrcCount: untrackedSrc.length,
    samplePaths,
    warning: `${untrackedSrc.length} untracked src/ file(s) — review before session-end. Sample: ${samplePaths.join(', ')}`,
  };
}

async function runGitStatusAsync(): Promise<UntrackedReport> {
  try {
    const { execFileSync } = await import('child_process');
    const stdout = execFileSync('git', ['status', '--short'], { encoding: 'utf8', timeout: 5000 });
    return checkUntrackedFiles(stdout);
  } catch (err: any) {
    return {
      status: 'unavailable',
      untrackedSrcCount: 0,
      samplePaths: [],
      warning: `git status failed: ${err?.message?.slice(0, 80) ?? 'unknown'}`,
    };
  }
}

async function sessionStartHandler(argv: ArgumentsCamelCase<SessionStartArgs>): Promise<void> {
  const start = Date.now();
  const waitMs = argv['daemon-wait-ms'] ?? 5000;

  const daemon = await ensureDaemon(waitMs);
  const cache = await warmupSubgraphCache(!!argv['skip-cache-warmup']);
  const peers = await checkPeerRegistry(!!argv['skip-peer-refresh']);
  const fleet = computeFleetState(daemon, peers);
  const untracked = await runGitStatusAsync();

  const ok = daemon.status !== 'failed';
  const report: SessionStartReport = {
    ok,
    daemon,
    cache,
    peers,
    fleet,
    untracked,
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
    const fleetIcon = fleet.state === 'healthy' ? '✓' : (fleet.state === 'partial' ? '~' : (fleet.state === 'isolated' ? '○' : '⚠'));
    console.log(`  fleet:     ${fleet.state.padEnd(10)} ${fleetIcon} others=${fleet.otherPeersInRegistry} conns=${fleet.connections}`);
    if (fleet.hint) console.log(`             ⚠ ${fleet.hint}`);
    const untrackedIcon = untracked.status === 'clean' ? '✓' : (untracked.status === 'some' ? '~' : '⚠');
    console.log(`  untracked: ${untracked.status.padEnd(10)} ${untrackedIcon} src-files=${untracked.untrackedSrcCount}`);
    if (untracked.warning) console.log(`             ⚠ ${untracked.warning}`);
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
