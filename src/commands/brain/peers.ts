/**
 * pop brain peers — list the known peer registry (T4-class follow-up, task #448).
 *
 * Stage 1 of the peer-registry arc. Reads `pop.brain.peers` from local state
 * and prints {peerId → multiaddrs, lastSeen, username}. The daemon-side
 * write + auto-dial integration lands in Stage 2 + Stage 3; this command
 * just exposes the surface so operators can inspect.
 *
 * With an empty registry (common until Stage 2 ships daemon-side writes),
 * prints a clear "no peers registered yet" message.
 *
 * See agent/brain/Knowledge/peer-registry-plan.md for the full design.
 */

import type { Argv, ArgumentsCamelCase } from 'yargs';
import { readBrainDoc } from '../../lib/brain';
import * as output from '../../lib/output';

interface PeersArgs {
  peer?: string;
  staleHours?: number;
}

interface PeerEntry {
  multiaddrs?: string[];
  lastSeen?: number;
  username?: string;
}

export const peersHandler = {
  builder: (yargs: Argv) =>
    yargs
      .option('peer', {
        type: 'string',
        describe: 'Filter to one peerId',
      })
      .option('stale-hours', {
        type: 'number',
        default: 1,
        describe: 'Flag entries with lastSeen older than this (default 1h)',
      }),

  handler: async (argv: ArgumentsCamelCase<PeersArgs>) => {
    try {
      let doc: any;
      let headCid: string | null = null;
      try {
        const res = await readBrainDoc('pop.brain.peers');
        doc = res.doc;
        headCid = res.headCid;
      } catch (err: any) {
        // Doc doesn't exist yet (pre-Stage 2 — no daemon writes) OR helia init failed.
        // Fall through to empty-registry path below.
        doc = { peers: {} };
      }
      const peersMap: Record<string, PeerEntry> = (doc && doc.peers) || {};
      const now = Math.floor(Date.now() / 1000);
      const staleSec = (argv.staleHours as number) * 3600;

      const entries = Object.entries(peersMap)
        .filter(([peerId]) => !argv.peer || peerId === argv.peer)
        .map(([peerId, e]) => ({
          peerId,
          multiaddrs: e.multiaddrs || [],
          lastSeen: e.lastSeen || 0,
          username: e.username || null,
          stale: e.lastSeen ? now - e.lastSeen > staleSec : true,
        }));

      if (output.isJsonMode()) {
        output.json({
          status: 'ok',
          headCid,
          peerCount: entries.length,
          staleCount: entries.filter(e => e.stale).length,
          peers: entries,
        });
        return;
      }

      if (entries.length === 0) {
        console.log('');
        console.log('  No peers registered yet.');
        console.log('  Stage 2 (task #448) will have the daemon auto-publish its own entry on start.');
        console.log('');
        return;
      }

      console.log('');
      console.log(`  Peer registry — ${entries.length} peer(s), ${entries.filter(e => e.stale).length} stale (> ${argv.staleHours}h)`);
      console.log('  ' + '─'.repeat(60));
      for (const e of entries) {
        const staleTag = e.stale ? ' [STALE]' : '';
        const userTag = e.username ? ` (${e.username})` : '';
        const ageSec = e.lastSeen ? now - e.lastSeen : null;
        const ageStr = ageSec === null ? 'never' : ageSec < 60 ? `${ageSec}s ago` : ageSec < 3600 ? `${Math.floor(ageSec / 60)}m ago` : `${Math.floor(ageSec / 3600)}h ago`;
        console.log('');
        console.log(`  ${e.peerId}${userTag}${staleTag}`);
        console.log(`    lastSeen:    ${ageStr}`);
        console.log(`    multiaddrs:  ${e.multiaddrs.length} entries`);
        for (const m of e.multiaddrs) {
          console.log(`                 ${m}`);
        }
      }
      console.log('');
    } catch (err: any) {
      output.error(err.message);
      process.exitCode = 1;
    }
  },
};
