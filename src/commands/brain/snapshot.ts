/**
 * pop brain snapshot — project a brain doc to markdown and write it to
 * agent/brain/Knowledge/<docId>.generated.md.
 *
 * This is the read-side counterpart to applyBrainChange. The heartbeat
 * skill calls this at end-of-heartbeat so the projection is kept in
 * sync on disk for human review and git archival. Step 8 of the plan
 * is when the hand-written files are retired and this becomes the
 * source of truth; until then, the output lives at a `.generated.md`
 * suffix so reviewers can diff it against the hand-written original.
 *
 * Graceful bootstrap: if the doc has no head CID yet (manifest empty),
 * the command exits 0 with a log line so that the heartbeat skill can
 * call it unconditionally without blowing up on fresh agents.
 */

import type { Argv, ArgumentsCamelCase } from 'yargs';
import { join } from 'path';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { readBrainDoc, stopBrainNode } from '../../lib/brain';
import { projectForDoc } from '../../lib/brain-projections';
import * as output from '../../lib/output';

interface SnapshotArgs {
  doc: string;
  outputPath?: string;
}

export const snapshotHandler = {
  builder: (yargs: Argv) =>
    yargs
      .option('doc', {
        describe: 'Brain document ID (e.g. pop.brain.shared)',
        type: 'string',
        demandOption: true,
      })
      .option('output-path', {
        describe: 'Explicit output path (default: agent/brain/Knowledge/<doc>.generated.md)',
        type: 'string',
      }),

  handler: async (argv: ArgumentsCamelCase<SnapshotArgs>) => {
    const docId = argv.doc;
    try {
      const { doc, headCid } = await readBrainDoc(docId);

      // Bootstrap case: no local head yet. Log + exit 0 so the
      // heartbeat skill can call us unconditionally.
      if (!headCid && (!doc || Object.keys(doc).length === 0)) {
        if (output.isJsonMode()) {
          output.json({ status: 'no-op', reason: 'no local head for this doc', docId });
        } else {
          console.log(`pop brain snapshot: no local head for "${docId}" — nothing to project yet.`);
        }
        return;
      }

      // Dispatch to the right projector based on docId. Unknown docIds
      // fall through to projectShared so older callers don't regress.
      const markdown = projectForDoc(docId, doc, headCid);

      // Default path: agent/brain/Knowledge/<docId>.generated.md
      // Use process.cwd() so the command writes into the repo the agent
      // is operating against — the heartbeat skill runs with the repo
      // as cwd, and ad-hoc invocations expect the same.
      const outPath =
        argv.outputPath ??
        join(process.cwd(), 'agent', 'brain', 'Knowledge', `${docId}.generated.md`);
      const outDir = outPath.substring(0, outPath.lastIndexOf('/'));
      if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

      writeFileSync(outPath, markdown);

      if (output.isJsonMode()) {
        output.json({
          status: 'ok',
          docId,
          headCid,
          bytes: markdown.length,
          path: outPath,
        });
      } else {
        console.log(`Wrote ${markdown.length} bytes to ${outPath}`);
        if (headCid) console.log(`Head CID: ${headCid}`);
      }
    } catch (err: any) {
      output.error(err.message);
      process.exitCode = 1;
    } finally {
      await stopBrainNode();
    }
  },
};
