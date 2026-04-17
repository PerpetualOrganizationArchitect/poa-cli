/**
 * pop brain heads — print the local heads frontier (T4, task #432).
 *
 * Prior to T4, every brain doc had exactly one head CID. T4 generalizes
 * to a multi-head frontier: multiple concurrent heads coexist until a
 * later write supersedes them. This command prints the current frontier
 * per doc (or just one doc via --doc).
 *
 * Useful for:
 *   - Debugging propagation: compare frontiers across agents to find
 *     concurrent heads that haven't converged
 *   - Verifying T4 Stage 3 end-to-end behavior (daemon rebroadcasts
 *     the frontier, peers fetch all CIDs, heads collapse on merge)
 *   - Operator-visible state during multi-agent write storms
 *
 * Reads from the local V2 manifest (doc-heads-v2.json, falls back to
 * doc-heads.json migrated in-memory). Does NOT start libp2p — purely
 * local state.
 */

import type { Argv, ArgumentsCamelCase } from 'yargs';
import { loadHeadsManifestV2 } from '../../lib/brain';
import * as output from '../../lib/output';

interface HeadsArgs {
  doc?: string;
}

export const headsHandler = {
  builder: (yargs: Argv) =>
    yargs.option('doc', {
      type: 'string',
      describe: 'Print frontier for this docId only (default: all docs)',
    }),

  handler: async (argv: ArgumentsCamelCase<HeadsArgs>) => {
    try {
      const manifest = loadHeadsManifestV2();
      const entries = argv.doc
        ? (manifest[argv.doc] ? [{ docId: argv.doc, cids: manifest[argv.doc] }] : [])
        : Object.entries(manifest).map(([docId, cids]) => ({ docId, cids }));

      if (output.isJsonMode()) {
        output.json({
          status: 'ok',
          docCount: entries.length,
          totalHeads: entries.reduce((n, e) => n + e.cids.length, 0),
          docs: entries,
        });
        return;
      }

      if (entries.length === 0) {
        if (argv.doc) {
          console.log(`  No frontier tracked for doc "${argv.doc}".`);
        } else {
          console.log('  No brain docs tracked locally.');
        }
        return;
      }

      console.log('');
      for (const { docId, cids } of entries) {
        const primary = cids[0];
        const concurrent = cids.slice(1);
        console.log(`  ${docId}`);
        console.log(`    primary:     ${primary}`);
        if (concurrent.length > 0) {
          console.log(`    concurrent:  ${concurrent.length} head(s) awaiting merge`);
          for (const cid of concurrent) {
            console.log(`                 ${cid}`);
          }
        } else {
          console.log(`    concurrent:  none (frontier collapsed)`);
        }
      }
      console.log('');
      const multiHeadDocs = entries.filter(e => e.cids.length > 1).length;
      if (multiHeadDocs > 0) {
        console.log(`  ${multiHeadDocs} doc(s) have concurrent heads — a local write or incoming merge will collapse them.`);
      }
      console.log('');
    } catch (err: any) {
      output.error(err.message);
      process.exitCode = 1;
    }
  },
};
