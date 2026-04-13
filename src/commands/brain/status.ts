/**
 * pop brain status — show the local brain layer state.
 *
 * MVP step 1: initialize a local Helia node, print the peer ID and
 * listening addresses, report connected peer count. No CRDT ops yet;
 * this is the "environment works" smoke test.
 *
 * Future steps will add doc sync status, known brain documents, and
 * per-document sync state.
 */

import type { Argv, ArgumentsCamelCase } from 'yargs';
import { getBrainNodeInfo, stopBrainNode } from '../../lib/brain';
import * as output from '../../lib/output';

export const statusHandler = {
  builder: (yargs: Argv) => yargs,

  handler: async (_argv: ArgumentsCamelCase<{}>) => {
    const spin = output.spinner('Initializing brain node...');
    spin.start();

    try {
      const info = await getBrainNodeInfo();
      spin.stop();

      if (output.isJsonMode()) {
        output.json({
          status: 'ok',
          ...info,
        });
      } else {
        console.log('');
        console.log('  Brain layer — P2P CRDT substrate');
        console.log('  ' + '─'.repeat(60));
        console.log(`  Helia version:    ${info.heliaVersion}`);
        console.log(`  Peer ID:          ${info.peerId}`);
        console.log(`  PeerId source:    ${info.peerIdSource}`);
        console.log(`  Peer key file:    ${info.peerKeyPath}`);
        console.log(`  Connected peers:  ${info.connectedPeers}`);
        console.log(`  Bootstrap known:  ${info.bootstrapPeerCount}`);
        console.log(`  Blockstore path:  ${info.blockstorePath}`);
        console.log('');
        if (info.listeningAddrs.length > 0) {
          console.log('  Listening on:');
          for (const addr of info.listeningAddrs) {
            console.log(`    ${addr}`);
          }
          console.log('');
        }
        if (info.subscribedTopics.length > 0) {
          console.log('  Subscribed topics:');
          for (const t of info.subscribedTopics) {
            const n = info.topicPeerCounts[t] ?? 0;
            console.log(`    ${t}  (${n} peer${n === 1 ? '' : 's'})`);
          }
        } else {
          console.log('  (no subscribed topics yet — run `pop brain subscribe --doc <id>` to listen)');
        }
        console.log('');
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    } finally {
      // Short-lived CLI invocation — clean shutdown so the process exits.
      await stopBrainNode();
    }
  },
};
