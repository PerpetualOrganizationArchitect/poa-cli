/**
 * pop brain repair — immediate repair pass over the T2 (task #430) dirty-doc
 * queue. Retries fetch+merge for every (docId, cid) in doc-dirty.json, or
 * just the one specified via --doc.
 *
 * The daemon's repairWorker runs this same logic every
 * POP_BRAIN_REPAIR_INTERVAL_MS (1h default). This CLI is the escape hatch
 * for operators who want to trigger a pass right now (e.g., after
 * confirming a previously-offline peer has come back).
 *
 * Exit 0 if all entries resolved (or already empty). Exit 1 if any entry
 * still dirty after the pass — operator should investigate.
 */

import type { Argv, ArgumentsCamelCase } from 'yargs';
import { loadDocDirty, fetchAndMergeRemoteHead, clearDocDirty } from '../../lib/brain';
import * as output from '../../lib/output';

interface RepairArgs {
  doc?: string;
}

export const repairHandler = {
  builder: (yargs: Argv) =>
    yargs.option('doc', {
      type: 'string',
      describe: 'Repair only this docId (default: all dirty docs)',
    }),

  handler: async (argv: ArgumentsCamelCase<RepairArgs>) => {
    const dirty = loadDocDirty();
    let entries = Object.entries(dirty);
    if (argv.doc) {
      entries = entries.filter(([d]) => d === argv.doc);
      if (entries.length === 0) {
        if (output.isJsonMode()) {
          output.json({ ok: true, action: 'none', reason: `doc ${argv.doc} not dirty` });
          return;
        }
        console.log(`  doc ${argv.doc} has no dirty entry — nothing to repair.`);
        return;
      }
    }
    if (entries.length === 0) {
      if (output.isJsonMode()) {
        output.json({ ok: true, count: 0, results: [] });
        return;
      }
      console.log('');
      console.log('  No dirty docs — nothing to repair.');
      console.log('');
      return;
    }

    const results: Array<{
      docId: string;
      cid: string;
      action: string;
      reason?: string;
      cleared: boolean;
    }> = [];
    let anyStillDirty = false;

    for (const [docId, entry] of entries) {
      try {
        const result = await fetchAndMergeRemoteHead(docId, entry.cid);
        let cleared = false;
        if (result.action === 'adopt' || result.action === 'merge') {
          // fetchAndMergeRemoteHead already clears dirty on these actions.
          cleared = true;
        } else if (result.action === 'skip') {
          // Stale-dirty — doc already at head via another path. Clear it.
          clearDocDirty(docId, entry.cid);
          cleared = true;
        } else {
          anyStillDirty = true;
        }
        results.push({
          docId,
          cid: entry.cid,
          action: result.action,
          reason: result.reason,
          cleared,
        });
      } catch (err: any) {
        anyStillDirty = true;
        results.push({
          docId,
          cid: entry.cid,
          action: 'error',
          reason: err.message,
          cleared: false,
        });
      }
    }

    if (output.isJsonMode()) {
      output.json({
        ok: !anyStillDirty,
        count: results.length,
        results,
      });
    } else {
      console.log('');
      console.log(`  Repair pass — ${results.length} entry${results.length === 1 ? '' : 'ies'}:`);
      console.log('  ' + '─'.repeat(60));
      for (const r of results) {
        const icon = r.cleared ? '✓' : '✗';
        console.log(`  ${icon} ${r.docId} ${r.cid.slice(0, 20)}… action=${r.action}`);
        if (r.reason) {
          console.log(`    ${r.reason.slice(0, 160)}`);
        }
      }
      console.log('');
      if (anyStillDirty) {
        console.log('  Some entries still dirty — check peer connectivity or investigate manually.');
        console.log('');
      }
    }

    if (anyStillDirty) process.exitCode = 1;
  },
};
