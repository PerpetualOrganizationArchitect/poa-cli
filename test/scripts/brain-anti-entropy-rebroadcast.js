#!/usr/bin/env node
/**
 * Brain layer — T1 anti-entropy rebroadcast integration test (task #429).
 *
 * Task #435 fix: the initial version of this test started daemons without
 * wiring them as peers (no POP_BRAIN_PEERS). Two daemons on separate
 * POP_BRAIN_HOMEs do NOT automatically discover each other on loopback
 * within a 45s budget — DHT discovery via public bootstrap nodes can
 * take longer, and loopback mDNS is platform-dependent. The existing
 * test/scripts/brain-daemon-two-instances.js solves this by reading B's
 * listen multiaddrs via status IPC and starting A with
 * POP_BRAIN_PEERS=<B's multiaddr> for auto-dial on startup. We use the
 * same pattern here.
 *
 * SCENARIO (per task #429 acceptance criteria):
 *   1. Start daemon A (isolated POP_BRAIN_HOME_A, no peers).
 *   2. Append a lesson via daemon A. A publishes the head announcement
 *      into the void — no other daemon is running to receive it.
 *   3. Stop daemon A. The head is in A's blockstore; the gossipsub
 *      announcement had no live receivers.
 *   4. Start daemon B fresh. Confirm B does NOT see the lesson
 *      (reproduces the pre-T1 failure mode).
 *   5. Restart daemon A with POP_BRAIN_PEERS=<B's multiaddr>, short
 *      POP_BRAIN_REBROADCAST_INTERVAL_MS (3000 in this test; production
 *      default 60000). Auto-dial forms the gossipsub mesh A↔B.
 *   6. Within WAIT_MS, A's rebroadcast tick re-publishes the head and
 *      B receives + merges it. `pop brain read` on B now shows the lesson.
 *
 * Exit codes:
 *   0  — success: lesson propagated A → B via rebroadcast after restart
 *   1  — failure: lesson still missing from B after WAIT_MS
 *
 * Env hooks:
 *   POP_PRIVATE_KEY     required — author key (both daemons use the same)
 *   POP_DEFAULT_ORG     required
 *   POP_DEFAULT_CHAIN   required
 *   WAIT_MS             optional — override propagation wait (default 45000)
 *
 * Run:  node test/scripts/brain-anti-entropy-rebroadcast.js
 */

'use strict';

const { spawnSync } = require('child_process');
const net = require('net');
const { mkdirSync, rmSync, existsSync, readFileSync } = require('fs');
const { join } = require('path');
const { homedir } = require('os');
const { killStalepopDaemons } = require('./lib/cleanup');

const REPO = join(__dirname, '..', '..');
const CLI = join(REPO, 'dist', 'index.js');

function loadDotEnv(path) {
  if (!existsSync(path)) return;
  const content = readFileSync(path, 'utf8');
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadDotEnv(join(homedir(), '.pop-agent', '.env'));
loadDotEnv(join(REPO, '.env'));

const HOME_A = '/tmp/pop-brain-t1-a';
const HOME_B = '/tmp/pop-brain-t1-b';
const WAIT_MS = parseInt(process.env.WAIT_MS || '45000', 10);
const SHORT_INTERVAL_MS = 3000;

function log(tag, msg) {
  console.error(`[${new Date().toISOString()}] [${tag}] ${msg}`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function resetHome(path) {
  if (existsSync(path)) {
    try { rmSync(path, { recursive: true, force: true }); } catch {}
  }
  mkdirSync(path, { recursive: true });
}

function cli(home, args, extraEnv = {}) {
  return spawnSync(process.execPath, [CLI, ...args], {
    env: { ...process.env, POP_BRAIN_HOME: home, ...extraEnv },
    encoding: 'utf8',
  });
}

async function waitForSocket(home, timeoutMs = 15000) {
  const sock = join(home, 'daemon.sock');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(sock)) return true;
    await sleep(200);
  }
  throw new Error(`socket never appeared: ${sock}`);
}

async function daemonStart(home, label, extraEnv = {}) {
  mkdirSync(home, { recursive: true });
  const fullEnv = {
    ...extraEnv,
    POP_BRAIN_REBROADCAST_INTERVAL_MS: String(SHORT_INTERVAL_MS),
    POP_BRAIN_REBROADCAST_JITTER: '0.2',
    POP_BRAIN_REBROADCAST_GRACE_MS: '1000',
  };
  const peers = fullEnv.POP_BRAIN_PEERS ? ` POP_BRAIN_PEERS=${fullEnv.POP_BRAIN_PEERS}` : '';
  log(label, `starting daemon (home=${home})${peers}`);
  const res = cli(home, ['brain', 'daemon', 'start'], fullEnv);
  if (res.status !== 0) {
    throw new Error(`daemon start failed for ${label}: ${res.stdout}\n${res.stderr}`);
  }
  await waitForSocket(home);
}

async function daemonStop(home, label) {
  log(label, 'stopping daemon');
  const res = cli(home, ['brain', 'daemon', 'stop']);
  if (res.status !== 0 && !/not running/i.test((res.stdout || '') + (res.stderr || ''))) {
    log(label, `stop returned ${res.status}: ${res.stdout} ${res.stderr}`);
  }
}

async function daemonStatusJson(home) {
  const sock = join(home, 'daemon.sock');
  return await new Promise((resolve, reject) => {
    const socket = net.createConnection(sock);
    let buf = '';
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error('status ipc timeout'));
    }, 10000);
    socket.on('connect', () => {
      socket.write(JSON.stringify({ id: '1', method: 'status' }) + '\n');
    });
    socket.on('data', chunk => {
      buf += chunk.toString('utf8');
      const nl = buf.indexOf('\n');
      if (nl >= 0) {
        clearTimeout(timer);
        try {
          const r = JSON.parse(buf.slice(0, nl));
          socket.end();
          if (r.error) reject(new Error(r.error));
          else resolve(r.result);
        } catch (e) { reject(e); }
      }
    });
    socket.on('error', err => { clearTimeout(timer); reject(err); });
  });
}

async function waitForLessonInHome(home, title, budgetMs) {
  const deadline = Date.now() + budgetMs;
  while (Date.now() < deadline) {
    const res = cli(home, ['brain', 'read', '--doc', 'pop.brain.shared']);
    if (res.status === 0 && (res.stdout || '').includes(title)) return true;
    await sleep(1000);
  }
  return false;
}

async function main() {
  if (!process.env.POP_PRIVATE_KEY) {
    log('setup', 'POP_PRIVATE_KEY missing — skipping');
    process.exit(0);
  }

  // Task #454: kill any orphaned daemons from prior interrupted runs.
  await killStalepopDaemons('pop-brain-t1-');

  resetHome(HOME_A);
  resetHome(HOME_B);

  let failed = false;
  try {
    // --- Phase 1: A alone writes a lesson ---
    await daemonStart(HOME_A, 'A');
    await sleep(2000);

    const title = `t1-anti-entropy-test-${Date.now()}`;
    log('A', `appending lesson "${title}"`);
    const append = cli(HOME_A, [
      'brain', 'append-lesson', '--doc', 'pop.brain.shared',
      '--title', title, '--body', 'integration test lesson body',
    ]);
    if (append.status !== 0) {
      throw new Error(`append failed: ${append.stdout}\n${append.stderr}`);
    }
    await sleep(1500);

    // --- Phase 2: stop A, start B, confirm B empty ---
    await daemonStop(HOME_A, 'A');
    await sleep(2000);
    await daemonStart(HOME_B, 'B');
    await sleep(2000);

    const statusB0 = await daemonStatusJson(HOME_B);
    log('B', `peerId=${statusB0.peerId} listenAddrs=${(statusB0.listenAddrs || []).join(',')}`);
    const loopbackAddrs = (statusB0.listenAddrs || [])
      .filter(a => a.startsWith('/ip4/127.0.0.1/') || a.startsWith('/ip4/0.0.0.0/'))
      .map(a => a.replace('/ip4/0.0.0.0/', '/ip4/127.0.0.1/'));
    if (loopbackAddrs.length === 0) {
      throw new Error(`B has no loopback multiaddr: ${statusB0.listenAddrs}`);
    }

    const bHasPre = await waitForLessonInHome(HOME_B, title, 3000);
    if (bHasPre) {
      log('FAIL', 'B sees lesson before A restart — test premise broken');
      failed = true; return;
    }
    log('B', 'confirmed B does NOT see lesson (pre-T1 failure mode)');

    // --- Phase 3: restart A with POP_BRAIN_PEERS=B's addr ---
    log('wire', `restarting A with POP_BRAIN_PEERS=${loopbackAddrs[0]}`);
    await daemonStart(HOME_A, 'A', { POP_BRAIN_PEERS: loopbackAddrs[0] });
    await sleep(4000); // mesh form window

    const statusA1 = await daemonStatusJson(HOME_A);
    const statusB1 = await daemonStatusJson(HOME_B);
    log('A', `post-restart: connections=${statusA1.connections} knownPeers=${statusA1.knownPeerCount}`);
    log('B', `post-dial: connections=${statusB1.connections} knownPeers=${statusB1.knownPeerCount}`);

    log('test', `awaiting rebroadcast delivery (interval=${SHORT_INTERVAL_MS}ms, budget=${WAIT_MS}ms)`);
    const landed = await waitForLessonInHome(HOME_B, title, WAIT_MS);
    if (!landed) {
      log('FAIL', `lesson did not reach B within ${WAIT_MS}ms`);
      const sA = await daemonStatusJson(HOME_A).catch(() => null);
      const sB = await daemonStatusJson(HOME_B).catch(() => null);
      if (sA) log('A-diag', `rebroadcastCount=${sA.rebroadcastCount} suppressed=${sA.rebroadcastsSuppressedBySeen} lastAt=${sA.lastRebroadcastAt}`);
      if (sB) log('B-diag', `incomingAnnouncements=${sB.incomingAnnouncements} merges=${sB.incomingMerges} rejects=${sB.incomingRejects}`);
      failed = true; return;
    }
    log('PASS', 'lesson reached B after A restart via rebroadcast ✓');
  } finally {
    try { await daemonStop(HOME_A, 'A-cleanup'); } catch {}
    try { await daemonStop(HOME_B, 'B-cleanup'); } catch {}
    await sleep(500);
    try { rmSync(HOME_A, { recursive: true, force: true }); } catch {}
    try { rmSync(HOME_B, { recursive: true, force: true }); } catch {}
  }
  process.exit(failed ? 1 : 0);
}

main().catch(err => {
  log('CRASH', err.stack || err.message);
  process.exit(1);
});
