/**
 * pop brain export — write a raw Automerge snapshot of a brain doc to a
 * file. Sister command to `pop brain import-snapshot` (task #353).
 *
 * Motivation (task #433 T5 design doc, HB#266):
 *   The T5 "GC + snapshot rollup" design picked Option B — append-only
 *   + deferred git-mediated re-genesis. For re-genesis the operator
 *   needs a snapshot blob they can commit as a new <docId>.genesis.bin
 *   in agent/brain/Knowledge/. This command produces that blob.
 *
 *   Flagged as a small follow-up in the T5 doc Section 3:
 *     "A `pop brain export` CLI to produce a snapshot blob on demand
 *      — pre-work for Option B's re-genesis step. Small (~1 HB)."
 *
 *   Shipping now because HB#316's Step 2.8 reflection surfaced it.
 *
 * Usage:
 *   pop brain export --doc pop.brain.shared --out /tmp/shared.bin
 *   pop brain export --doc pop.brain.shared --out=-           # stdout (= form)
 *   pop brain export --doc pop.brain.shared --out stdout      # stdout (alias)
 *   pop brain export --doc pop.brain.shared --json            # meta only
 *
 * Note: `--out -` without the `=` is parsed by yargs as a flag,
 * not a value. Use `--out=-` or the `stdout` alias for stdout mode.
 *
 * The output file can be:
 *   - Committed as agent/brain/Knowledge/<docId>.genesis.bin for future
 *     fresh-bootstrap of new agents to the current state (option B
 *     re-genesis flow from T5).
 *   - Imported into another brain home via `pop brain import-snapshot`.
 *   - Inspected with Automerge tools for debugging.
 */

import type { Argv, ArgumentsCamelCase } from 'yargs';
import { writeFileSync } from 'fs';
import { openBrainDoc, stopBrainNode } from '../../lib/brain';
import * as output from '../../lib/output';

interface ExportArgs {
  doc?: string;
  out?: string;
}

async function getAutomergeSave(): Promise<(doc: any) => Uint8Array> {
  const esmImport = new Function('s', 'return import(s)') as (s: string) => Promise<any>;
  const Automerge = await esmImport('@automerge/automerge');
  return Automerge.save ?? Automerge.default?.save;
}

export const exportHandler = {
  builder: (yargs: Argv) =>
    yargs
      .option('doc', {
        type: 'string',
        describe: 'Brain doc ID (e.g., pop.brain.shared)',
        demandOption: true,
      })
      .option('out', {
        type: 'string',
        describe: "Output path. '--out=-' or '--out stdout' for stdout. Default: <docId>.snapshot.bin in cwd.",
      }),

  handler: async (argv: ArgumentsCamelCase<ExportArgs>) => {
    try {
      const docId = argv.doc as string;
      const { doc, headCid } = await openBrainDoc(docId);
      const save = await getAutomergeSave();
      const bytes: Uint8Array = save(doc);
      const outPath = argv.out === undefined
        ? `${docId}.snapshot.bin`
        : argv.out;

      if (outPath === '-' || outPath === 'stdout') {
        // Write raw bytes to stdout. When piped to another process,
        // process.stdout is non-blocking; .write() may return false
        // if the kernel buffer is full. Wait for drain to ensure all
        // bytes flush before we exit.
        const ok = process.stdout.write(Buffer.from(bytes));
        if (!ok) {
          await new Promise<void>(resolve => process.stdout.once('drain', () => resolve()));
        }
      } else {
        writeFileSync(outPath, Buffer.from(bytes));
      }

      if (output.isJsonMode()) {
        output.json({
          status: 'ok',
          docId,
          headCid,
          bytes: bytes.byteLength,
          outPath: outPath === '-' ? '<stdout>' : outPath,
        });
      } else if (outPath !== '-' && outPath !== 'stdout') {
        console.log('');
        console.log(`  Exported ${docId} — ${bytes.byteLength} bytes`);
        console.log(`  Head CID: ${headCid ?? '(none — empty doc)'}`);
        console.log(`  Wrote:    ${outPath}`);
        console.log('');
        console.log(`  Next steps:`);
        console.log(`    - Commit as agent/brain/Knowledge/${docId}.genesis.bin for fresh-bootstrap`);
        console.log(`    - Or import on another agent: pop brain import-snapshot --doc ${docId} --file ${outPath}`);
        console.log('');
      }

      try { await stopBrainNode(); } catch {}
      await new Promise(r => setTimeout(r, 50));
      process.exit(0);
    } catch (err: any) {
      output.error(err.message);
      process.exitCode = 1;
      try { await stopBrainNode(); } catch {}
    }
  },
};
