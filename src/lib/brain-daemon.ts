/**
 * Brain daemon — persistent libp2p process that keeps gossipsub alive between
 * agent CLI invocations and periodically re-broadcasts the local manifest's
 * head CIDs so peers coming online can catch up.
 *
 * ## Why
 *
 * The brain layer's HB#322 dogfood finding: three consecutive vigil_01 brain
 * writes were invisible to argus_prime because agent sessions run in separate
 * 15-min cron slots and never overlap in wall-clock time. Gossipsub is
 * broadcast-only (no store-and-forward), so announcements published while a
 * peer is offline vanish permanently. Every agent ended up with a per-agent
 * append-only journal, not a shared substrate.
 *
 * Hudson's HB#322 directive: fix it properly with a long-running daemon. No
 * shortcuts. Model it on the go-ds-crdt reference architecture
 * (github.com/ipfs/go-ds-crdt, examples/globaldb/globaldb.go).
 *
 * ## Design (mapped from go-ds-crdt)
 *
 *   go-ds-crdt                  |  This module
 *   -----------------------------|--------------------------------------
 *   Datastore (long-lived)       |  runDaemon() — single process per agent
 *   Broadcaster (PubSub)         |  existing publishBrainHead / subscribeBrainTopic
 *   DAGSyncer (DAGService)       |  existing Helia blockstore + Bitswap
 *   RebroadcastInterval = 1m     |  REBROADCAST_INTERVAL_MS = 60_000
 *   keepalive netTopic (20s)     |  KEEPALIVE_TOPIC + 20s interval
 *   seenHeads map                |  DEFERRED — v1 rebroadcasts unconditionally
 *   RepairInterval = 1h          |  DEFERRED — MVP envelope is snapshot-per-write
 *                                |  so there's no DAG to walk
 *   signal handling              |  SIGTERM / SIGINT / SIGHUP
 *   PutHook / DeleteHook         |  DEFERRED — v2 adds IPC routing so existing
 *                                |  commands become clients
 *
 * ## Process model
 *
 *   pop brain daemon start        parent spawns a detached child running
 *                                 `node dist/index.js brain daemon __run`;
 *                                 parent writes PID file and exits
 *   pop brain daemon __run        the child entrypoint, calls runDaemon()
 *   pop brain daemon stop         reads PID, sends SIGTERM, waits cleanup
 *   pop brain daemon status       reads PID, checks liveness, opens Unix
 *                                 socket, sends {method: "status"}, prints
 *   pop brain daemon logs         tails daemon.log
 *
 *   ${POP_BRAIN_HOME}/daemon.pid  parent-written PID file
 *   ${POP_BRAIN_HOME}/daemon.sock Unix socket for IPC (mode 0600)
 *   ${POP_BRAIN_HOME}/daemon.log  append-only log
 *
 * ## IPC protocol
 *
 * Newline-delimited JSON over Unix socket. Each request is one line:
 *
 *   {"id": "1", "method": "status"}
 *
 * Each response is one line:
 *
 *   {"id": "1", "result": {...}}
 *   {"id": "1", "error": "..."}
 *
 * First-ship methods: status. Second-ship methods: appendLesson, readDoc,
 * snapshot — those let existing CLI commands route through a running daemon
 * instead of spinning up their own libp2p.
 */

import net from 'net';
import { join } from 'path';
import { homedir } from 'os';
import {
  writeFileSync,
  readFileSync,
  existsSync,
  unlinkSync,
  createWriteStream,
  chmodSync,
} from 'fs';
import { ethers } from 'ethers';
import {
  getBrainHome,
  initBrainNode,
  stopBrainNode,
  subscribeBrainTopic,
  publishBrainHead,
  fetchAndMergeRemoteHead,
  listBrainDocs,
  topicForDoc,
} from './brain';

export const REBROADCAST_INTERVAL_MS = 60_000;
export const KEEPALIVE_INTERVAL_MS = 20_000;
export const KEEPALIVE_TOPIC = 'pop/brain/net/v1';

export function getDaemonPidPath(): string {
  return join(getBrainHome(), 'daemon.pid');
}

export function getDaemonSockPath(): string {
  return join(getBrainHome(), 'daemon.sock');
}

export function getDaemonLogPath(): string {
  return join(getBrainHome(), 'daemon.log');
}

/**
 * Check if a daemon appears to be running for this brain home.
 * Returns the PID if alive, null otherwise. Cleans up stale PID files.
 */
export function getRunningDaemonPid(): number | null {
  const p = getDaemonPidPath();
  if (!existsSync(p)) return null;
  let pid: number;
  try {
    pid = parseInt(readFileSync(p, 'utf8').trim(), 10);
  } catch {
    return null;
  }
  if (!Number.isFinite(pid) || pid <= 0) return null;
  try {
    // Signal 0 probes for process existence without actually signaling.
    process.kill(pid, 0);
    return pid;
  } catch (err: any) {
    if (err.code === 'ESRCH') {
      // Stale PID file — process is gone. Clean up.
      try { unlinkSync(p); } catch {}
      const sp = getDaemonSockPath();
      if (existsSync(sp)) {
        try { unlinkSync(sp); } catch {}
      }
      return null;
    }
    // EPERM or other — process exists but we can't signal it.
    return pid;
  }
}

interface DaemonStats {
  startedAt: number;
  rebroadcastCount: number;
  keepaliveCount: number;
  lastRebroadcastAt: number | null;
  lastKeepaliveAt: number | null;
  incomingAnnouncements: number;
  incomingMerges: number;
}

/**
 * Run the daemon event loop. Blocks until a termination signal arrives.
 * This is the __run entrypoint invoked by the detached child process.
 *
 * NEVER call this from the parent CLI path — it will never return.
 */
export async function runDaemon(): Promise<void> {
  const home = getBrainHome();
  const pidPath = getDaemonPidPath();
  const sockPath = getDaemonSockPath();
  const logPath = getDaemonLogPath();

  // Guard against double-start. The parent already checked via
  // getRunningDaemonPid(), but this is a second line of defense for
  // direct __run invocations.
  const existingPid = getRunningDaemonPid();
  if (existingPid !== null && existingPid !== process.pid) {
    throw new Error(
      `Brain daemon already running with PID ${existingPid} for ${home}`,
    );
  }

  // Author address is derived from POP_PRIVATE_KEY, same as applyBrainChange.
  // Used only for the rebroadcast envelope — the head CID itself is the
  // authenticated payload, so the announcement "author" is metadata.
  let authorAddress: string;
  try {
    const key = process.env.POP_PRIVATE_KEY;
    if (!key) throw new Error('POP_PRIVATE_KEY not set');
    authorAddress = new ethers.Wallet(key).address.toLowerCase();
  } catch (err: any) {
    throw new Error(
      `Brain daemon cannot start: ${err.message}. Set POP_PRIVATE_KEY in your env.`,
    );
  }

  const logStream = createWriteStream(logPath, { flags: 'a' });
  const log = (msg: string) => {
    const line = `${new Date().toISOString()} [${process.pid}] ${msg}\n`;
    logStream.write(line);
  };

  log(`daemon starting — home=${home} author=${authorAddress}`);

  // Write the PID file. This happens AFTER the environment check so a
  // failed start doesn't leave a stale PID.
  writeFileSync(pidPath, String(process.pid), { mode: 0o600 });

  // Initialize libp2p once for the whole daemon lifetime. All CLI
  // commands invoked while the daemon is up will (eventually) route
  // through IPC instead of spinning up their own node.
  const node = await initBrainNode();
  log(`libp2p up — peer=${node.libp2p.peerId.toString()}`);

  const stats: DaemonStats = {
    startedAt: Date.now(),
    rebroadcastCount: 0,
    keepaliveCount: 0,
    lastRebroadcastAt: null,
    lastKeepaliveAt: null,
    incomingAnnouncements: 0,
    incomingMerges: 0,
  };

  // --- Subscribe to the keepalive net topic ---
  //
  // The globaldb example publishes "hi!" on a separate netTopic every 20s
  // so that the libp2p ConnManager tags participating peers with a "keep"
  // priority and refuses to evict them. We port that verbatim.
  const pubsub = node.libp2p.services.pubsub;
  pubsub.subscribe(KEEPALIVE_TOPIC);
  log(`subscribed keepalive topic ${KEEPALIVE_TOPIC}`);

  // Tag peers who publish on the keepalive topic (a rough port of
  // h.ConnManager().TagPeer(msg.ReceivedFrom, "keep", 100)). libp2p-js
  // exposes this via node.libp2p.peerStore.merge(peerId, {tags: {...}}).
  const keepaliveListener = async (evt: any) => {
    const msg = evt.detail;
    if (!msg || msg.topic !== KEEPALIVE_TOPIC) return;
    const from = msg.from;
    if (!from) return;
    try {
      await node.libp2p.peerStore.merge(from, {
        tags: { 'pop-brain-keep': { value: 50 } },
      });
    } catch (err: any) {
      // Non-fatal; peerStore.merge errors on some libp2p versions if the
      // peer isn't in the store yet. Log and move on.
      log(`keepalive tag err ${from}: ${err.message}`);
    }
  };
  pubsub.addEventListener('message', keepaliveListener);

  // --- Subscribe to every doc topic in the local manifest ---
  //
  // The daemon process keeps these subscriptions alive across CLI
  // invocations. Incoming head-CID announcements fire fetchAndMergeRemoteHead
  // immediately — no more "the CLI exited before the announcement arrived".
  const subscribedDocs = new Set<string>();
  const unsubscribes: Array<() => void> = [];

  async function subscribeDoc(docId: string): Promise<void> {
    if (subscribedDocs.has(docId)) return;
    subscribedDocs.add(docId);
    const unsub = await subscribeBrainTopic(docId, (ann, from) => {
      stats.incomingAnnouncements += 1;
      log(`recv doc=${docId} cid=${ann.cid} from=${from} author=${ann.author}`);
      // Fire-and-forget the block fetch + merge. Errors are logged.
      fetchAndMergeRemoteHead(ann.docId, ann.cid)
        .then(result => {
          if (result.action !== 'skip') {
            stats.incomingMerges += 1;
          }
          log(`merge doc=${docId} cid=${ann.cid} action=${result.action} reason=${result.reason}`);
        })
        .catch(err => {
          log(`merge err doc=${docId} cid=${ann.cid}: ${err.message}`);
        });
    });
    unsubscribes.push(unsub);
    log(`subscribed doc ${docId}`);
  }

  for (const { docId } of listBrainDocs()) {
    try {
      await subscribeDoc(docId);
    } catch (err: any) {
      log(`subscribe err ${docId}: ${err.message}`);
    }
  }

  // --- Rebroadcast loop ---
  //
  // go-ds-crdt default: every 60s, re-publish current heads so peers that
  // came online after the last write can catch up. We do an unconditional
  // rebroadcast of every head in the manifest; the seenHeads optimization
  // is deferred to v2.
  const rebroadcastTimer = setInterval(async () => {
    const docs = listBrainDocs();
    for (const { docId, headCid } of docs) {
      // If the manifest picked up a new doc since startup, make sure we
      // are also subscribed to its topic.
      if (!subscribedDocs.has(docId)) {
        try { await subscribeDoc(docId); } catch {}
      }
      try {
        await publishBrainHead(docId, headCid, authorAddress);
        stats.rebroadcastCount += 1;
        stats.lastRebroadcastAt = Date.now();
      } catch (err: any) {
        log(`rebroadcast err doc=${docId}: ${err.message}`);
      }
    }
  }, REBROADCAST_INTERVAL_MS);

  // --- Keepalive loop ---
  //
  // Publish "alive" to the net topic every 20s. This both tags peers and
  // keeps pubsub mesh connections from going idle.
  const keepaliveTimer = setInterval(async () => {
    try {
      await pubsub.publish(
        KEEPALIVE_TOPIC,
        new TextEncoder().encode(`alive ${Date.now()}`),
      );
      stats.keepaliveCount += 1;
      stats.lastKeepaliveAt = Date.now();
    } catch (err: any) {
      log(`keepalive err: ${err.message}`);
    }
  }, KEEPALIVE_INTERVAL_MS);

  // --- IPC server ---
  //
  // Unix socket, newline-delimited JSON-RPC. First-ship methods: status.
  // Second-ship will add appendLesson/readDoc/snapshot.
  if (existsSync(sockPath)) {
    try { unlinkSync(sockPath); } catch {}
  }

  const server = net.createServer(socket => {
    let buf = '';
    socket.on('data', chunk => {
      buf += chunk.toString('utf8');
      let idx: number;
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        handleIpcLine(line, socket).catch(err => {
          log(`ipc handler err: ${err.message}`);
        });
      }
    });
    socket.on('error', err => {
      log(`ipc socket err: ${err.message}`);
    });
  });

  async function handleIpcLine(line: string, socket: net.Socket): Promise<void> {
    if (!line.trim()) return;
    let req: any;
    try {
      req = JSON.parse(line);
    } catch (err: any) {
      socket.write(JSON.stringify({ error: `bad json: ${err.message}` }) + '\n');
      return;
    }
    const id = req.id ?? null;
    try {
      const result = await dispatchIpc(req.method, req.params);
      socket.write(JSON.stringify({ id, result }) + '\n');
    } catch (err: any) {
      socket.write(JSON.stringify({ id, error: err.message }) + '\n');
    }
  }

  async function dispatchIpc(method: string, _params: any): Promise<any> {
    switch (method) {
      case 'status': {
        const topics = pubsub.getTopics?.() ?? [];
        const peers = node.libp2p.getPeers().map((p: any) => p.toString());
        const connections = node.libp2p.getConnections().length;
        return {
          peerId: node.libp2p.peerId.toString(),
          uptime: Math.floor((Date.now() - stats.startedAt) / 1000),
          connections,
          knownPeerCount: peers.length,
          topics,
          subscribedDocs: Array.from(subscribedDocs),
          rebroadcastCount: stats.rebroadcastCount,
          lastRebroadcastAt: stats.lastRebroadcastAt,
          keepaliveCount: stats.keepaliveCount,
          lastKeepaliveAt: stats.lastKeepaliveAt,
          incomingAnnouncements: stats.incomingAnnouncements,
          incomingMerges: stats.incomingMerges,
          brainHome: home,
          pidPath,
          sockPath,
          logPath,
        };
      }
      case 'ping': {
        return { pong: true, ts: Date.now() };
      }
      default:
        throw new Error(`Unknown IPC method: ${method}`);
    }
  }

  await new Promise<void>((resolve, reject) => {
    server.listen(sockPath, () => resolve());
    server.on('error', reject);
  });
  try {
    chmodSync(sockPath, 0o600);
  } catch {}
  log(`IPC listening on ${sockPath}`);

  // --- Graceful shutdown ---
  let shuttingDown = false;
  const shutdown = async (sig: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log(`shutdown signal ${sig}`);
    clearInterval(rebroadcastTimer);
    clearInterval(keepaliveTimer);
    try { pubsub.removeEventListener('message', keepaliveListener); } catch {}
    for (const u of unsubscribes) {
      try { u(); } catch {}
    }
    await new Promise<void>(res => server.close(() => res()));
    if (existsSync(sockPath)) { try { unlinkSync(sockPath); } catch {} }
    if (existsSync(pidPath)) { try { unlinkSync(pidPath); } catch {} }
    try { await stopBrainNode(); } catch (err: any) { log(`stop err: ${err.message}`); }
    log(`shutdown complete`);
    logStream.end();
    // Give the log stream a tick to flush, then exit.
    setTimeout(() => process.exit(0), 50);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGHUP', () => shutdown('SIGHUP'));
  process.on('uncaughtException', err => {
    log(`uncaught: ${err.stack ?? err.message}`);
    shutdown('uncaughtException');
  });

  log(
    `daemon ready — rebroadcast=${REBROADCAST_INTERVAL_MS}ms ` +
    `keepalive=${KEEPALIVE_INTERVAL_MS}ms ` +
    `subscribed=${subscribedDocs.size} docs`,
  );

  // Park forever. The timers and the IPC server keep the event loop alive.
  // Shutdown only happens via signal handler.
  await new Promise(() => {});
}

/**
 * IPC client helper: send a request to the running daemon. Throws if no
 * daemon is running.
 */
export async function sendIpcRequest(
  method: string,
  params: any = {},
  timeoutMs = 5000,
): Promise<any> {
  const sockPath = getDaemonSockPath();
  if (!existsSync(sockPath)) {
    throw new Error(`No brain daemon socket at ${sockPath}. Run "pop brain daemon start".`);
  }
  return await new Promise((resolve, reject) => {
    const socket = net.createConnection(sockPath);
    let buf = '';
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`IPC timeout after ${timeoutMs}ms`));
    }, timeoutMs);
    socket.on('data', chunk => {
      buf += chunk.toString('utf8');
      const nl = buf.indexOf('\n');
      if (nl >= 0) {
        clearTimeout(timer);
        const line = buf.slice(0, nl);
        try {
          const res = JSON.parse(line);
          socket.end();
          if (res.error) reject(new Error(res.error));
          else resolve(res.result);
        } catch (err: any) {
          reject(new Error(`bad ipc response: ${err.message}`));
        }
      }
    });
    socket.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });
    socket.write(JSON.stringify({ id: Date.now().toString(), method, params }) + '\n');
  });
}
