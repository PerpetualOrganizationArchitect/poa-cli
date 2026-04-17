# Brain layer integration tests

Test scripts that exercise the brain CRDT substrate end-to-end by
spawning real `pop brain daemon` processes against isolated `/tmp`
home directories.

Run individually: `node test/scripts/<script>.js`. Run `yarn test` for
the vitest unit-test suite (different thing — vitest covers pure
functions; these scripts cover daemon + gossipsub + Bitswap + CRDT).

## Current scripts

| Script | Tmp prefix | Task | Coverage |
|---|---|---|---|
| `brain-anti-entropy-rebroadcast.js` | `pop-brain-t1-` | #429 | T1 rebroadcast delivers lesson after A-restart |
| `brain-daemon-two-instances.js` | `pop-brain-test-` | #324 | Two-daemon mesh + cross-agent propagation |
| `brain-disjoint-history.js` | `pop-brain-disjoint-` | #350 | Disjoint-history detection refuses bad merge |
| `brain-frontier-convergence.js` | `pop-brain-t4-` | #432 | T4 3-agent concurrent-write frontier convergence |
| `brain-peer-heads-divergence.js` | `pop-brain-t6-` | #434 | T6 doctor head-divergence probe |

## Test-fixture isolation (task #454)

Integration tests that spawn brain daemons on fixed ports hit
EADDRINUSE when PRIOR test runs' daemons are still alive. This
happens most often when the prior run was interrupted:
- `timeout 90 node test-script.js` (SIGTERM doesn't propagate to
  spawned node children on macOS by default)
- Ctrl-C during a long test
- crashes before the finally-block cleanup runs

The orphaned daemon holds its port, sock file, and PID file. The next
test run sees EADDRINUSE and fails to start.

**Fix**: each script calls `killStalepopDaemons('<its-prefix>-')` at
the top of `main()` before any `daemonStart`. The helper
(`test/scripts/lib/cleanup.js`) enumerates `/tmp/<prefix>*`,
SIGTERMs any live PIDs, waits up to 5s for sockets to release,
SIGKILLs stragglers, then `rmSync`s the home dirs.

If you add a new integration test that spawns daemons:
1. Pick a unique tmp prefix (e.g. `pop-brain-t7-`).
2. `const { killStalepopDaemons } = require('./lib/cleanup');`
3. `await killStalepopDaemons('pop-brain-t7-');` at top of `main()`.
4. Use tmp homes `/tmp/pop-brain-t7-a`, `/tmp/pop-brain-t7-b`, etc.
5. Update the table above.

## Fixed ports vs derived ports

Some tests pin `POP_BRAIN_LISTEN_PORT=<N>` per daemon (e.g. the T4
test uses 35051/35052/35053). Others let the `pop brain` binary
derive a port from the private key hash (task #447's 34000-43999
range). Fixed-port tests are more deterministic but require
manual cleanup of orphans between runs (hence `killStalepopDaemons`).
Derived-port tests can accidentally collide when two fresh tmp
homes hash to the same offset (1-in-10,000) — widen the range with
a vendored fixed-port override in the test if it flakes.

## Why these are Node scripts, not vitest cases

`brain.ts` bridges CJS → ESM-only helia/libp2p via
`new Function('s','return import(s)')`. Vitest's VM isolation
refuses to resolve that dynamic import (ERR_VM_DYNAMIC_IMPORT_-
CALLBACK_MISSING). Plain node against `dist/` resolves it natively.
Lesson learned on #295.
