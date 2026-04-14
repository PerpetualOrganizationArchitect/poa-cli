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
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { readBrainDoc, stopBrainNode } from '../../lib/brain';
import { projectForDoc } from '../../lib/brain-projections';
import * as output from '../../lib/output';

interface SnapshotArgs {
  doc: string;
  outputPath?: string;
  force?: boolean;
}

/**
 * Count top-level H3 headers in a generated brain markdown projection.
 * Both pop.brain.shared (lessons) and pop.brain.projects (projects)
 * use `### ` as the per-item header, so this doubles as a "content
 * item count" for regression detection.
 */
function countH3Items(md: string): number {
  const matches = md.match(/^### /gm);
  return matches ? matches.length : 0;
}

/** Parse the "*Head CID: `...`*" line from a generated projection file. */
function parseExistingHeadCid(md: string): string | null {
  const m = /^\*Head CID: `([^`]+)`\*/m.exec(md);
  return m?.[1] ?? null;
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
      })
      .option('force', {
        describe:
          'Overwrite the existing generated.md even if it would regress (fewer lessons/projects than the file currently on disk). Use only when you know local state is authoritative.',
        type: 'boolean',
        default: false,
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

      // Regression guard (task #328): if the existing generated.md has
      // MORE content items (H3 headers) than our local projection, the
      // local state is probably behind the peer-merged team state and
      // writing would silently regress the committed file. Refuse with
      // a clear error unless --force. The heartbeat skill calls
      // `pop brain snapshot ... || true` so exit-1 here lets the HB
      // continue without committing the regressed file.
      if (existsSync(outPath) && !argv.force) {
        const existingContent = readFileSync(outPath, 'utf8');
        const existingCount = countH3Items(existingContent);
        const newCount = countH3Items(markdown);
        if (newCount < existingCount) {
          const existingCid = parseExistingHeadCid(existingContent);
          const msg =
            `pop brain snapshot would regress ${outPath}: ` +
            `existing file has ${existingCount} items (head ${existingCid ?? '?'}), ` +
            `local doc projects to ${newCount} items (head ${headCid ?? '?'}). ` +
            `This usually means the local state lacks peer-merged content. ` +
            `Run \`pop brain subscribe --doc ${docId}\` first to sync, ` +
            `or pass \`--force\` to overwrite anyway.`;
          if (output.isJsonMode()) {
            output.json({
              status: 'refused',
              reason: 'regression',
              docId,
              path: outPath,
              existingCount,
              newCount,
              existingHead: existingCid,
              localHead: headCid,
            });
          } else {
            console.error(msg);
          }
          process.exitCode = 1;
          return;
        }
      }

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
