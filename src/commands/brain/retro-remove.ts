/**
 * pop brain retro remove — soft-delete a retro from pop.brain.retros.
 *
 * Same tombstone pattern as remove-lesson / remove-project:
 * {removed: true, removedAt, removedBy, removedReason?}. The retro
 * stays in the Automerge doc (for CRDT-safe merge with concurrent
 * edits) but is filtered out of the main projection and surfaced in
 * a compact "## Removed retros" summary.
 *
 * Useful for: test retros, retros that were started in error, and
 * retros where the entire window turned out to be a no-op and there's
 * nothing worth shipping.
 */

import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import { stopBrainNode } from '../../lib/brain';
import { routedDispatch } from '../../lib/brain-ops';
import * as output from '../../lib/output';

interface RetroRemoveArgs {
  doc: string;
  retroId: string;
  reason?: string;
}

export const retroRemoveHandler = {
  builder: (yargs: Argv) =>
    yargs
      .positional('retro-id', {
        describe: 'The retro.id to tombstone',
        type: 'string',
      })
      .option('doc', {
        describe: 'Brain document ID (default: pop.brain.retros)',
        type: 'string',
        default: 'pop.brain.retros',
      })
      .option('reason', {
        describe: 'Optional human-readable reason recorded on the tombstone',
        type: 'string',
      })
      .demandOption('retro-id'),

  handler: async (argv: ArgumentsCamelCase<RetroRemoveArgs>) => {
    try {
      const key = process.env.POP_PRIVATE_KEY;
      if (!key) {
        output.error(
          'POP_PRIVATE_KEY not set — cannot record removedBy. Set the env var and retry.',
        );
        process.exitCode = 1;
        return;
      }
      const removerAddress = new ethers.Wallet(key).address.toLowerCase();
      const now = Math.floor(Date.now() / 1000);

      const result = await routedDispatch({
        type: 'removeRetro',
        docId: argv.doc,
        retroId: argv.retroId,
        removedBy: removerAddress,
        removedAt: now,
        removedReason: argv.reason,
      });

      if (output.isJsonMode()) {
        output.json({
          status: 'ok',
          docId: argv.doc,
          retroId: argv.retroId,
          removedAt: now,
          removedBy: removerAddress,
          removedReason: argv.reason ?? null,
          headCid: result.headCid,
          routedViaDaemon: result.routedViaDaemon,
        });
      } else {
        console.log('');
        console.log(`  Retro "${argv.retroId}" tombstoned in ${argv.doc}`);
        console.log(`  removedBy: ${removerAddress}`);
        console.log(`  removedAt: ${new Date(now * 1000).toISOString()}`);
        if (argv.reason) console.log(`  reason:    ${argv.reason}`);
        console.log(`  new head:  ${result.headCid}`);
        console.log(`  routed:    ${result.routedViaDaemon ? 'via brain daemon' : 'in-process (no daemon)'}`);
        console.log('');
      }
    } catch (err: any) {
      output.error(err.message);
      process.exitCode = 1;
    } finally {
      await stopBrainNode();
    }
  },
};
