/**
 * pop brain peer-addr — print this agent's derived libp2p multiaddr.
 *
 * Task #447 follow-up. After #447 gave each agent a deterministic
 * listen port (derived from privateKey hash, 34000-34999 range), the
 * mesh-bootstrap workflow is:
 *
 *   1. On each agent, run `pop brain peer-addr` to get the local
 *      multiaddr like /ip4/127.0.0.1/tcp/34407/p2p/<peerId>.
 *   2. Operator collects the 3 addresses into a comma-separated value.
 *   3. Operator sets POP_BRAIN_PEERS=<comma-list> in each .env (minus
 *      self, or with self — auto-dial ignores self).
 *   4. Restart each daemon. Mesh forms automatically on start.
 *
 * This command exists specifically to make step 1 a one-line query
 * instead of parsing `pop brain daemon status --json` manually.
 *
 * Does NOT require a running daemon — the derived port comes from
 * the persistent peer-key.json, and the peerId from that key. We
 * briefly initialize a libp2p node to extract the peer id; this is
 * one of the cases where the #447 derived-port might collide with a
 * running daemon, which is why we check isOtherDaemonRunning() (via
 * initBrainNode's fallback to random port 0 when the daemon holds
 * the derived port — then we explicitly report what the DERIVED port
 * would be, not the actually-bound random port).
 */

import type { Argv, ArgumentsCamelCase } from 'yargs';
import { initBrainNode, stopBrainNode } from '../../lib/brain';
import * as output from '../../lib/output';

interface PeerAddrArgs {
  host?: string;
}

export const peerAddrHandler = {
  builder: (yargs: Argv) =>
    yargs.option('host', {
      type: 'string',
      describe: 'Host address to print (default: 127.0.0.1)',
      default: '127.0.0.1',
    }),

  handler: async (argv: ArgumentsCamelCase<PeerAddrArgs>) => {
    try {
      const node = await initBrainNode();
      const peerId = node.libp2p.peerId.toString();

      // The running libp2p instance will listen on a random port if
      // another daemon holds the derived port (see initBrainNode's
      // isOtherDaemonRunning fallback). To give the operator the
      // STABLE derived port (which is what should go in
      // POP_BRAIN_PEERS), read it from the daemon status IPC if
      // a daemon is running; otherwise read it from this node's
      // listen addrs. Both paths end at the same derived port
      // under normal conditions.
      let port: string | null = null;

      // Prefer the running daemon's port if it's up — that's the
      // port peers will actually dial.
      try {
        const { sendIpcRequest } = await import('../../lib/brain-daemon');
        const status: any = await sendIpcRequest('status', {});
        if (status && Array.isArray(status.listenAddrs)) {
          for (const addr of status.listenAddrs) {
            const m = /\/ip4\/[^/]+\/tcp\/(\d+)/.exec(addr);
            if (m) { port = m[1]; break; }
          }
        }
      } catch {
        // No daemon running or IPC failed — fall through to local node.
      }

      if (port === null) {
        const addrs = node.libp2p.getMultiaddrs().map((m: any) => m.toString());
        for (const addr of addrs) {
          const m = /\/ip4\/[^/]+\/tcp\/(\d+)/.exec(addr);
          if (m) { port = m[1]; break; }
        }
      }

      if (port === null) {
        output.error('could not determine listen port');
        process.exitCode = 1;
        await stopBrainNode().catch(() => {});
        return;
      }

      const host = argv.host || '127.0.0.1';
      const multiaddr = `/ip4/${host}/tcp/${port}/p2p/${peerId}`;

      if (output.isJsonMode()) {
        output.json({ peerId, host, port: Number(port), multiaddr });
      } else {
        console.log(multiaddr);
      }

      await stopBrainNode().catch(() => {});
    } catch (err: any) {
      output.error(err.message);
      process.exitCode = 1;
    }
  },
};
