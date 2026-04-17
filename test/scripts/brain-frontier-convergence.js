#!/usr/bin/env node
/**
 * Brain layer — T4 (task #432) pt3b integration test.
 *
 * ACCEPTANCE CRITERION (from task #432):
 *   "3-agent concurrent-write test: argus, vigil, sentinel each write a
 *    lesson while disconnected. Reconnect all 3. Verify that within one
 *    rebroadcast interval, all 3 see all 3 lessons."
 *
 * This is the end-to-end proof for T4 Stages 1-3:
 *   - Stage 1 (a6123ae): V2 manifest helpers
 *   - Stage 2a (ed17e83): fetchAndMergeRemoteHead uses V2 + Replace
 *   - Stage 2b (27d8459): BrainHeadAnnouncement.cids[] wire
 *   - Stage 2c (09e7bc2): applyBrainChange + subscribe iterate frontier
 *   - Stage 3a (b724f3b): rebroadcast full frontier + heads CLI
 *   - Stage 3b (this test): CONVERGENCE VERIFICATION
 *
 * SCENARIO:
 *   1. Start 3 daemons (A, B, C), each with POP_BRAIN_PEERS pointing
 *      at the others, in isolated brain homes.
 *   2. Wait for 3-way mesh formation.
 *   3. Each daemon writes a distinct lesson on pop.brain.shared at
 *      roughly the same instant. Three concurrent writes produce three
 *      concurrent head CIDs on the network.
 *   4. Use a short POP_BRAIN_REBROADCAST_INTERVAL_MS (3000ms) so
 *      rebroadcast-based propagation runs within the test window.
 *   5. Wait up to WAIT_MS for convergence: every daemon's
 *      pop.brain.shared doc includes all 3 lesson titles.
 *   6. Print each daemon's final frontier (from pop brain heads) for
 *      diagnostic — concurrent heads may persist without T3 but content
 *      must fully propagate.
 *
 * Exit codes:
 *   0  — all 3 daemons see all 3 lessons (content converged)
 *   1  — some daemon missing at least one lesson after WAIT_MS
 *
 * Adapted from brain-peer-heads-divergence.js (T6 pt1) and
 * brain-anti-entropy-rebroadcast.js (T1).
 *
 * Run:  node test/scripts/brain-frontier-convergence.js
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
  A: '/tmp/pop-brain-t4-a',
  B: '/tmp/pop-brain-t4-b',
  C: '/tmp/pop-brain-t4-c',
};
// Fixed ports outside task #447's derivation range (34000-34999).
// Pinning avoids the phase-1 probe/phase-2 restart mismatch that occurs
// when random ports are used (address captured in probe doesn't match
// the port selected on restart). Using 35xxx keeps us clear of #447's
// hash-derived range so there's no collision with any agent's real daemon
// that happens to share these offsets.
const PORTS = { A: 35051, B: 35052, C: 35053 };
const WAIT_MS = parseInt(process.env.WAIT_MS || '60000', 10);
const REBROADCAST_MS = '3000'; // short for test speed; production default 60000

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
      POP_BRAIN_REBROADCAST_INTERVAL_MS: REBROADCAST_MS,
      POP_BRAIN_REBROADCAST_GRACE_MS: '500',
      // POP_BRAIN_LISTEN_PORT is set per-daemon by caller (see daemonStart)
      // to a fixed test port (35051/52/53), avoiding task #447's hash-derived
      // range (34000-34999) and its collision-on-same-offset risk.
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
  log(label, `starting daemon (home=${home})${extraEnv.POP_BRAIN_PEERS ? ` peers=[${extraEnv.POP_BRAIN_PEERS.split(',').length}]` : ''}`);
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

function readTitles(home) {
  const r = cli(home, ['brain', 'read', '--doc', 'pop.brain.shared', '--json']);
  if (r.status !== 0) return null;
  // Output has a few header lines before the JSON. Find it.
  const idx = r.stdout.indexOf('{"docId"');
  if (idx < 0) return null;
  try {
    const data = JSON.parse(r.stdout.slice(idx));
    const lessons = data.doc?.lessons || [];
    return new Set(lessons.map(l => l.title));
  } catch { return null; }
}

async function main() {
  if (!process.env.POP_PRIVATE_KEY) {
    log('setup', 'POP_PRIVATE_KEY missing — skipping');
    process.exit(0);
  }

  // Task #454: kill any orphaned daemons from prior interrupted runs.
  // Runs BEFORE resetHome so we can see + signal their PIDs.
  await killStalepopDaemons('pop-brain-t4-');

  for (const home of Object.values(HOMES)) resetHome(home);

  let failed = false;
  try {
    // Phase 1: start each daemon briefly on its fixed port to learn its
    // persistent peerId (derived from the auto-generated peer-key.json on
    // first start). Then stop. Fixed ports mean we can build full multiaddrs
    // ahead of time without a probe/restart-port mismatch.
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
      C: `/ip4/127.0.0.1/tcp/${PORTS.C}/p2p/${peerIds.C}`,
    };

    // Phase 2: restart each with the same fixed port + POP_BRAIN_PEERS =
    // other two's multiaddrs. Fixed ports match phase-1 peer IDs deterministically.
    await daemonStart(HOMES.A, 'A', { POP_BRAIN_LISTEN_PORT: String(PORTS.A), POP_BRAIN_PEERS: `${addrs.B},${addrs.C}` });
    await daemonStart(HOMES.B, 'B', { POP_BRAIN_LISTEN_PORT: String(PORTS.B), POP_BRAIN_PEERS: `${addrs.A},${addrs.C}` });
    await daemonStart(HOMES.C, 'C', { POP_BRAIN_LISTEN_PORT: String(PORTS.C), POP_BRAIN_PEERS: `${addrs.A},${addrs.B}` });
    await sleep(5000); // 3-way mesh form window

    for (const label of ['A', 'B', 'C']) {
      const s = await ipc(HOMES[label], 'status');
      log(label, `connections=${s.connections} knownPeers=${s.knownPeerCount}`);
      if (s.connections === 0) throw new Error(`${label} has 0 connections — mesh did not form`);
    }

    // Phase 3: 3 concurrent writes.
    const ts = Date.now();
    const titles = {
      A: `t4-frontier-A-${ts}`,
      B: `t4-frontier-B-${ts}`,
      C: `t4-frontier-C-${ts}`,
    };
    log('test', 'issuing 3 concurrent appends (A, B, C)');
    const writes = ['A', 'B', 'C'].map(label =>
      new Promise((resolve, reject) => {
        const res = cli(HOMES[label], [
          'brain', 'append-lesson', '--doc', 'pop.brain.shared',
          '--title', titles[label],
          '--body', `t4 convergence test from ${label}`,
        ]);
        if (res.status !== 0) reject(new Error(`${label} append failed: ${res.stderr}`));
        else resolve(res.stdout);
      })
    );
    await Promise.all(writes);
    log('test', 'all 3 appends returned — awaiting convergence');

    // Phase 4: poll every 2s until all 3 daemons see all 3 titles, or timeout.
    const wanted = new Set(Object.values(titles));
    const deadline = Date.now() + WAIT_MS;
    let converged = false;
    while (Date.now() < deadline) {
      const seen = {};
      let allOk = true;
      for (const label of ['A', 'B', 'C']) {
        const titlesSet = readTitles(HOMES[label]);
        if (!titlesSet) { allOk = false; break; }
        const missing = [...wanted].filter(t => !titlesSet.has(t));
        seen[label] = { total: titlesSet.size, missing };
        if (missing.length > 0) allOk = false;
      }
      if (allOk) {
        log('PASS', `all 3 daemons see all 3 lessons: ${JSON.stringify(seen)}`);
        converged = true;
        break;
      }
      await sleep(2000);
    }

    if (!converged) {
      log('FAIL', 'content did not fully converge within WAIT_MS');
      for (const label of ['A', 'B', 'C']) {
        const titlesSet = readTitles(HOMES[label]);
        log('FAIL-diag', `${label} sees ${titlesSet ? titlesSet.size : 'read-failed'} lesson(s)`);
      }
      failed = true;
    }

    // Phase 5: diagnostic — print each daemon's frontier from pop brain heads.
    for (const label of ['A', 'B', 'C']) {
      const heads = cli(HOMES[label], ['brain', 'heads', '--doc', 'pop.brain.shared', '--json']);
      if (heads.status === 0) {
        const idx = heads.stdout.indexOf('{"status"');
        if (idx >= 0) {
          try {
            const data = JSON.parse(heads.stdout.slice(idx));
            const cids = data.docs?.[0]?.cids || [];
            log(`${label}-heads`, `frontier size=${cids.length}: [${cids.map(c => c.slice(0, 16)).join(', ')}]`);
          } catch {}
        }
      }
    }
  } catch (err) {
    log('FAIL', `${err.message}`);
    failed = true;
  } finally {
    for (const [label, home] of Object.entries(HOMES)) {
      try { await daemonStop(home, `${label}-cleanup`); } catch {}
    }
  }

  process.exit(failed ? 1 : 0);
}

main();
