/**
 * pop brain remove-lesson — mark an existing lesson as soft-deleted.
 *
 * Sets a tombstone on the lesson object:
 *
 *   {
 *     removed: true,
 *     removedAt: <unix-seconds>,
 *     removedBy: <signing wallet address>,
 *     removedReason: <optional --reason string>
 *   }
 *
 * The lesson stays in doc.lessons — the projection layer filters
 * tombstoned entries out of rendered markdown. This is the CRDT-safe
 * shape: hard delete from an Automerge list can lose concurrent edits,
 * and two concurrent soft-deletes converge via last-write-wins at the
 * field level (adding `removed: true` twice is idempotent).
 *
 * No --undo / --restore in this ship. If we need undelete later, the
 * shape is another field like `restoredAt` that supersedes removedAt.
 */

import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import {
  openBrainDoc,
  applyBrainChange,
  stopBrainNode,
} from '../../lib/brain';
import * as output from '../../lib/output';

interface RemoveArgs {
  doc: string;
  lessonId: string;
  reason?: string;
}

export const removeLessonHandler = {
  builder: (yargs: Argv) =>
    yargs
      .option('doc', {
        describe: 'Brain document ID (e.g. pop.brain.shared)',
        type: 'string',
        demandOption: true,
      })
      .option('lesson-id', {
        describe: 'The lesson.id to tombstone',
        type: 'string',
        demandOption: true,
      })
      .option('reason', {
        describe: 'Optional human-readable reason recorded on the tombstone',
        type: 'string',
      }),

  handler: async (argv: ArgumentsCamelCase<RemoveArgs>) => {
    try {
      // Pre-flight peek: locate the lesson, fail fast with candidate
      // ids if not found. Same pattern as edit-lesson.
      const { doc: currentDoc } = await openBrainDoc(argv.doc);
      const lessons: any[] = Array.isArray(currentDoc?.lessons) ? currentDoc.lessons : [];
      const target = lessons.find((l: any) => l?.id === argv.lessonId);
      if (!target) {
        const candidates = lessons
          .map((l: any) => l?.id)
          .filter((id: any) => typeof id === 'string')
          .slice(0, 8);
        output.error(
          `Lesson "${argv.lessonId}" not found in ${argv.doc}. ` +
            `Available ids (first 8): ${candidates.join(', ') || '(none)'}`,
        );
        process.exitCode = 1;
        return;
      }

      // Already tombstoned — short-circuit.
      if (target.removed === true) {
        if (output.isJsonMode()) {
          output.json({
            status: 'already-removed',
            docId: argv.doc,
            lessonId: argv.lessonId,
            removedAt: target.removedAt,
            removedBy: target.removedBy,
          });
        } else {
          console.log(
            `Lesson "${argv.lessonId}" is already tombstoned ` +
              `(removedAt=${target.removedAt}, removedBy=${target.removedBy}). No-op.`,
          );
        }
        return;
      }

      // Derive the remover address from POP_PRIVATE_KEY so the
      // tombstone's removedBy matches the signing envelope's author.
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

      // Apply the tombstone inside a single Automerge change so the
      // whole mutation lands as one signed snapshot. Re-find the
      // lesson inside the change fn — the pre-flight `target` is
      // bound to the plain-JS clone from openBrainDoc, not the
      // mutable Automerge proxy. (Same gotcha as edit-lesson.)
      const result = await applyBrainChange(argv.doc, (doc: any) => {
        if (!Array.isArray(doc.lessons)) return;
        const idx = doc.lessons.findIndex((l: any) => l?.id === argv.lessonId);
        if (idx === -1) return;
        const lesson = doc.lessons[idx];
        lesson.removed = true;
        lesson.removedAt = now;
        lesson.removedBy = removerAddress;
        if (argv.reason !== undefined) {
          lesson.removedReason = argv.reason;
        }
      });

      if (output.isJsonMode()) {
        output.json({
          status: 'ok',
          docId: argv.doc,
          lessonId: argv.lessonId,
          headCid: result.headCid,
          removedAt: now,
          removedBy: removerAddress,
          removedReason: argv.reason ?? null,
        });
      } else {
        console.log('');
        console.log(`  Lesson "${argv.lessonId}" tombstoned in ${argv.doc}`);
        console.log(`  removedBy: ${removerAddress}`);
        console.log(`  removedAt: ${new Date(now * 1000).toISOString()}`);
        if (argv.reason) console.log(`  reason:    ${argv.reason}`);
        console.log(`  new head:  ${result.headCid}`);
        console.log('');
        console.log(
          `  The lesson is still in the Automerge doc (pop brain read still shows it). ` +
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
