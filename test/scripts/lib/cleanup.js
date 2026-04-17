/**
 * Test-fixture cleanup helper for brain-daemon integration tests.
 *
 * Task #454 (HB#292 vigil_01): integration tests that spawn brain daemons
 * on fixed ports (e.g. brain-frontier-convergence.js uses 35051-35053)
 * hit EADDRINUSE when a PRIOR test run's daemons are still alive. This
 * happens most often when the prior run was interrupted:
 *   - timeout 90 node test-script.js  (SIGTERM doesn't propagate on macOS)
 *   - Ctrl-C'd during a long test
 *   - crashed before the finally-block cleanup ran
 *
 * The orphan daemon holds its port, its sock file, and its PID file.
 * The next test run sees EADDRINUSE and fails to start.
 *
 * This module provides killStalepopDaemons(prefix) — call it at the TOP
 * of each test-script's main() before any daemonStart calls. It:
 *   1. Enumerates /tmp/<prefix><any>/daemon.pid files.
 *   2. SIGTERMs each PID (best-effort, skip unreachable).
 *   3. Waits up to 5s for each sock file to disappear.
 *   4. Falls back to SIGKILL after the wait if sock still exists.
 *   5. Removes the whole /tmp/<prefix><any> directory tree.
 *
 * After the function returns, any subsequent daemonStart with
 * POP_BRAIN_HOME=/tmp/<prefix><suffix> gets a clean filesystem state.
 *
 * Usage in a test script:
 *
 *   const { killStalepopDaemons } = require('./lib/cleanup');
 *   // ... at top of main() ...
 *   await killStalepopDaemons('pop-brain-t4-');   // for t4-a, t4-b, t4-c
 *
 * CONSTRAINT: prefix must be specific to THIS test (e.g. 'pop-brain-t4-')
 * so cross-test interference is not a cleanup vector. Never pass an
 * empty string or a too-broad prefix — we do NOT want a test harness
 * inadvertently killing a production agent's daemon in POP_BRAIN_HOME.
 */

'use strict';

const { readdirSync, existsSync, readFileSync, rmSync } = require('fs');
const { join } = require('path');

/**
 * Best-effort: kill any daemon whose PID file lives under /tmp/<prefix>*,
 * wait for sockets to release, remove the home dirs.
 *
 * @param {string} prefix - e.g. "pop-brain-t4-" — MUST be specific; empty
 *   string or very-short prefix is rejected to avoid killing the wrong
 *   daemons.
 * @param {object} [opts]
 * @param {number} [opts.maxWaitMs=5000] - how long to wait per home for
 *   the sock file to disappear.
 */
async function killStalepopDaemons(prefix, opts = {}) {
  if (typeof prefix !== 'string' || prefix.length < 4) {
    throw new Error(
      `killStalepopDaemons: prefix must be a string of length >= 4 ` +
      `(got ${JSON.stringify(prefix)}). Safety guard: prevents killing ` +
      `non-test daemons.`,
    );
  }
  const tmp = '/tmp';
  const maxWaitMs = opts.maxWaitMs ?? 5000;
  let entries;
  try {
    entries = readdirSync(tmp);
  } catch {
    return;
  }
  const matches = entries.filter(e => e.startsWith(prefix));
  if (matches.length === 0) return;

  // Phase 1: SIGTERM every live daemon we find.
  const killed = [];
  for (const dir of matches) {
    const home = join(tmp, dir);
    const pidPath = join(home, 'daemon.pid');
    const sockPath = join(home, 'daemon.sock');
    if (!existsSync(pidPath)) {
      killed.push({ home, sockPath, pid: null });
      continue;
    }
    let pid;
    try {
      pid = parseInt(readFileSync(pidPath, 'utf8').trim(), 10);
    } catch {
      killed.push({ home, sockPath, pid: null });
      continue;
    }
    if (!Number.isFinite(pid) || pid <= 0) {
      killed.push({ home, sockPath, pid: null });
      continue;
    }
    try { process.kill(pid, 'SIGTERM'); } catch {
      // already dead or not signalable — fall through to wait-and-clean.
    }
    killed.push({ home, sockPath, pid });
  }

  // Phase 2: wait up to maxWaitMs per home for the sock to disappear.
  for (const { home, sockPath, pid } of killed) {
    const deadline = Date.now() + maxWaitMs;
    while (Date.now() < deadline && existsSync(sockPath)) {
      await new Promise(r => setTimeout(r, 100));
    }
    if (existsSync(sockPath) && pid != null) {
      // Still there — escalate to SIGKILL.
      try { process.kill(pid, 'SIGKILL'); } catch {}
      await new Promise(r => setTimeout(r, 200));
    }
    // Remove the whole home tree — belt and suspenders.
    try {
      rmSync(home, { recursive: true, force: true });
    } catch {}
  }
}

module.exports = { killStalepopDaemons };
