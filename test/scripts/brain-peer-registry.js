#!/usr/bin/env node
/**
 * Brain layer — T4-class integration test for task #448 peer registry.
 *
 * ACCEPTANCE (from task #448):
 *   "sentinel running `pop brain daemon start` discovers argus + vigil via
 *    pop.brain.peers without operator-managed POP_BRAIN_PEERS. Tested by
 *    restarting argus + vigil daemons (port change) and verifying sentinel
 *    reconnects within 60s."
 *
 * WHAT THIS TEST VERIFIES (pt4 — minimum viable acceptance):
 *   1. Daemon auto-publishes its own entry to pop.brain.peers on start (pt2).
 *   2. Auto-published entry propagates via gossipsub to a peered daemon.
 *   3. The peered daemon's `pop brain peers --json` sees both entries
 *      (self + the other) within one redial interval.
 *
 * WHAT THIS TEST DOES NOT VERIFY (left for future pt4b if needed):
 *   - "Cold start without POP_BRAIN_PEERS ever set" — requires pre-seeded
 *     registry snapshot, which is a separate bootstrap path (task #427 family).
 *   - "Port change recovery" — requires port-change orchestration.
 *   - 3-agent transitive discovery (A→B, B→C, does A learn C?).
 *
 * SCENARIO:
 *   1. Start A and B in isolated homes, with POP_BRAIN_PEERS pointing at
 *      each other (the standard bootstrap). Short refresh intervals so
 *      writes happen within test budget.
 *   2. Wait for mesh to form (3-way: A+B + some DHT bootstrap).
 *   3. Wait for each daemon's peersWriteTick to have fired at least once.
 *   4. Poll `pop brain peers --json` on both daemons until each sees
 *      TWO entries (self + other), or timeout.
 *   5. Verify:
 *      a. Both daemons see both peerIds
 *      b. Each entry has at least one /ip4/ multiaddr
 *      c. lastSeen populated on all entries
 *      d. Not stale
 *
 * Exit codes:
 *   0  — both daemons see both entries, end-to-end registry propagation works
 *   1  — missing entry after budget expires, or shape check failed
 *
 * Uses fixed ports 35054/35055 outside task #447's derivation range to
 * avoid collision with real agent daemons + with other integration tests
 * (brain-frontier-convergence uses 35051-53).
 *
 * Run:  node test/scripts/brain-peer-registry.js
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

const HOMES = {
  A: '/tmp/pop-brain-peerreg-a',
  B: '/tmp/pop-brain-peerreg-b',
};
const PORTS = { A: 35054, B: 35055 };
const PEERS_REFRESH_MS = '3000';     // short for test speed
const REDIAL_INTERVAL_MS = '5000';   // short for test speed
const WAIT_MS = parseInt(process.env.WAIT_MS || '45000', 10);

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
    env: {
      ...process.env,
      POP_BRAIN_HOME: home,
      POP_BRAIN_PEERS_REFRESH_MS: PEERS_REFRESH_MS,
      POP_BRAIN_REDIAL_INTERVAL_MS: REDIAL_INTERVAL_MS,
      ...extraEnv,
    },
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
  log(label, `starting daemon (home=${home})`);
  const res = cli(home, ['brain', 'daemon', 'start'], extraEnv);
  if (res.status !== 0) {
    throw new Error(`daemon start failed for ${label}: ${res.stdout}\n${res.stderr}`);
  }
  await waitForSocket(home);
}

async function daemonStop(home, label) {
  log(label, 'stopping daemon');
  cli(home, ['brain', 'daemon', 'stop']);
}

async function ipc(home, method, params = {}, timeoutMs = 5000) {
  const sock = join(home, 'daemon.sock');
  return await new Promise((resolve, reject) => {
    const socket = net.createConnection(sock);
    let buf = '';
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`${method} ipc timeout`));
    }, timeoutMs);
    socket.on('connect', () => {
      socket.write(JSON.stringify({ id: '1', method, params }) + '\n');
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

function readPeerRegistry(home) {
  const r = cli(home, ['brain', 'peers', '--json']);
  if (r.status !== 0) return null;
  const idx = r.stdout.indexOf('{"status"');
  if (idx < 0) return null;
  try { return JSON.parse(r.stdout.slice(idx)); } catch { return null; }
}

async function main() {
  if (!process.env.POP_PRIVATE_KEY) {
    log('setup', 'POP_PRIVATE_KEY missing — skipping');
    process.exit(0);
  }

  await killStalepopDaemons('pop-brain-peerreg-');

  for (const home of Object.values(HOMES)) resetHome(home);

  let failed = false;
  try {
    // Phase 1: probe each daemon's peerId (with fixed port, peerId is stable)
    const peerIds = {};
    for (const [label, home] of Object.entries(HOMES)) {
      await daemonStart(home, label, { POP_BRAIN_LISTEN_PORT: String(PORTS[label]) });
      await sleep(1500);
      const status = await ipc(home, 'status');
      peerIds[label] = status.peerId;
      log(label, `peerId=${status.peerId} port=${PORTS[label]}`);
      await daemonStop(home, label);
      await sleep(500);
    }

    const addrs = {
      A: `/ip4/127.0.0.1/tcp/${PORTS.A}/p2p/${peerIds.A}`,
      B: `/ip4/127.0.0.1/tcp/${PORTS.B}/p2p/${peerIds.B}`,
    };

    // Phase 2: restart both with POP_BRAIN_PEERS mutual
    await daemonStart(HOMES.A, 'A', { POP_BRAIN_LISTEN_PORT: String(PORTS.A), POP_BRAIN_PEERS: addrs.B });
    await daemonStart(HOMES.B, 'B', { POP_BRAIN_LISTEN_PORT: String(PORTS.B), POP_BRAIN_PEERS: addrs.A });
    await sleep(5000);

    for (const label of ['A', 'B']) {
      const s = await ipc(HOMES[label], 'status');
      log(label, `connections=${s.connections} knownPeers=${s.knownPeerCount}`);
      if (s.connections === 0) throw new Error(`${label} has 0 connections — mesh did not form`);
    }

    // Phase 3: poll peer-registry on both daemons until each sees 2 entries
    log('test', `awaiting both daemons to see both peer entries (budget=${WAIT_MS}ms)`);
    const deadline = Date.now() + WAIT_MS;
    let seenByA = null;
    let seenByB = null;
    while (Date.now() < deadline) {
      const regA = readPeerRegistry(HOMES.A);
      const regB = readPeerRegistry(HOMES.B);
      if (regA && regB && regA.peerCount === 2 && regB.peerCount === 2) {
        seenByA = regA;
        seenByB = regB;
        break;
      }
      await sleep(1500);
    }

    if (!seenByA || !seenByB) {
      log('FAIL', `registry propagation did not converge within ${WAIT_MS}ms`);
      const finalA = readPeerRegistry(HOMES.A);
      const finalB = readPeerRegistry(HOMES.B);
      log('FAIL-diag', `A has ${finalA ? finalA.peerCount : 'read-failed'} entries`);
      log('FAIL-diag', `B has ${finalB ? finalB.peerCount : 'read-failed'} entries`);
      failed = true;
      return;
    }

    // Shape checks
    function checkEntry(labelPrefix, reg, expectedPeerIds) {
      const byId = new Map(reg.peers.map(p => [p.peerId, p]));
      for (const id of expectedPeerIds) {
        const e = byId.get(id);
        if (!e) {
          log('FAIL', `${labelPrefix} missing entry for ${id}`);
          failed = true;
          return;
        }
        if (!Array.isArray(e.multiaddrs) || e.multiaddrs.length === 0) {
          log('FAIL', `${labelPrefix} entry ${id} missing multiaddrs`);
          failed = true;
          return;
        }
        if (typeof e.lastSeen !== 'number' || e.lastSeen === 0) {
          log('FAIL', `${labelPrefix} entry ${id} missing lastSeen`);
          failed = true;
          return;
        }
        if (e.stale) {
          log('FAIL', `${labelPrefix} entry ${id} flagged stale (should be fresh)`);
          failed = true;
          return;
        }
      }
    }
    checkEntry('A', seenByA, [peerIds.A, peerIds.B]);
    checkEntry('B', seenByB, [peerIds.A, peerIds.B]);

    if (!failed) {
      log('PASS', 'both daemons see both peer entries with valid shape');
      log('A-heads', `peerCount=${seenByA.peerCount} headCid=${seenByA.headCid?.slice(0, 16)}...`);
      log('B-heads', `peerCount=${seenByB.peerCount} headCid=${seenByB.headCid?.slice(0, 16)}...`);
    }
  } catch (err) {
    log('FAIL', err.message);
    failed = true;
  } finally {
    for (const [label, home] of Object.entries(HOMES)) {
      try { await daemonStop(home, `${label}-cleanup`); } catch {}
    }
  }

  process.exit(failed ? 1 : 0);
}

main();
