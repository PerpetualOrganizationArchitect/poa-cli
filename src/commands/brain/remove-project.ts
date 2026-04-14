/**
 * pop brain remove-project — soft-delete a project entry in pop.brain.projects.
 *
 * Mirror of remove-lesson (#304). Sets {removed: true, removedAt,
 * removedBy, removedReason?} on the project object. The raw Automerge
 * state is unchanged; projectProjects filters tombstoned projects
 * out of the main Projects section and surfaces a compact '## Removed
 * projects' summary at the bottom.
 *
 * Soft delete stays CRDT-safe: concurrent tombstones are idempotent
 * at the field-level LWW, and concurrent edits to a project that's
 * tombstoned concurrently still converge cleanly.
 */

import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import { openBrainDoc, stopBrainNode } from '../../lib/brain';
import { routedDispatch } from '../../lib/brain-ops';
import * as output from '../../lib/output';

interface RemoveProjectArgs {
  doc: string;
  projectId: string;
  reason?: string;
}

export const removeProjectHandler = {
  builder: (yargs: Argv) =>
    yargs
      .option('doc', {
        describe: 'Brain document ID (typically pop.brain.projects)',
        type: 'string',
        demandOption: true,
      })
      .option('project-id', {
        describe: 'The project.id to tombstone',
        type: 'string',
        demandOption: true,
      })
      .option('reason', {
        describe: 'Optional human-readable reason recorded on the tombstone',
        type: 'string',
      }),

  handler: async (argv: ArgumentsCamelCase<RemoveProjectArgs>) => {
    try {
      const { doc: currentDoc } = await openBrainDoc(argv.doc);
      const projects: any[] = Array.isArray(currentDoc?.projects) ? currentDoc.projects : [];
      const target = projects.find((p: any) => p?.id === argv.projectId);
      if (!target) {
        const candidates = projects
          .map((p: any) => p?.id)
          .filter((id: any) => typeof id === 'string')
          .slice(0, 8);
        output.error(
          `Project "${argv.projectId}" not found in ${argv.doc}. ` +
            `Available ids (first 8): ${candidates.join(', ') || '(none)'}`,
        );
        process.exitCode = 1;
        return;
      }

      if (target.removed === true) {
        if (output.isJsonMode()) {
          output.json({
            status: 'already-removed',
            docId: argv.doc,
            projectId: argv.projectId,
            removedAt: target.removedAt,
            removedBy: target.removedBy,
          });
        } else {
          console.log(
            `Project "${argv.projectId}" is already tombstoned ` +
              `(removedAt=${target.removedAt}, removedBy=${target.removedBy}). No-op.`,
          );
        }
        return;
      }

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

      // Route through the unified dispatcher (HB#324 ship-2).
      const result = await routedDispatch({
        type: 'removeProject',
        docId: argv.doc,
        projectId: argv.projectId,
        removedBy: removerAddress,
        removedAt: now,
        removedReason: argv.reason,
      });

      if (output.isJsonMode()) {
        output.json({
          status: 'ok',
          docId: argv.doc,
          projectId: argv.projectId,
          headCid: result.headCid,
          routedViaDaemon: result.routedViaDaemon,
          removedAt: now,
          removedBy: removerAddress,
          removedReason: argv.reason ?? null,
        });
      } else {
        console.log('');
        console.log(`  Project "${argv.projectId}" tombstoned in ${argv.doc}`);
        console.log(`  removedBy: ${removerAddress}`);
        console.log(`  removedAt: ${new Date(now * 1000).toISOString()}`);
        if (argv.reason) console.log(`  reason:    ${argv.reason}`);
        console.log(`  new head:  ${result.headCid}`);
        console.log(`  routed:    ${result.routedViaDaemon ? 'via brain daemon' : 'in-process (no daemon)'}`);
        console.log('');
        console.log(
          `  The project is still in the Automerge doc (pop brain read still shows it). ` +
            `The next pop brain snapshot will filter it out of the rendered markdown.`,
        );
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
