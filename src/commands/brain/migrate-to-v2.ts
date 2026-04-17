/**
 * pop brain migrate-to-v2 — wrap a doc's v1 snapshot chain in a single v2
 * genesis envelope (delta-per-write IPLD with parent CID links).
 *
 * Per agent/artifacts/research/brain-wire-format-v2-design.md Section 6.
 * Task #431 (T3) Sprint 17 P1.
 *
 * Operator runbook (per agent, one-time):
 *   pop brain migrate-to-v2 --doc pop.brain.shared
 *   pop brain migrate-to-v2 --doc pop.brain.projects
 *   ...repeat for each canonical doc
 *
 * Or migrate all canonical docs at once:
 *   pop brain migrate-to-v2 --all
 *
 * The migration is idempotent: a doc whose head is already a v2 envelope
 * exits with action='already-v2', no chain modification.
 *
 * Verification: after writing the v2 envelope, the command reloads the doc
 * via openBrainDoc (which routes v2 reads through loadDocFromV2Chain) and
 * compares Automerge.save() bytes against the source. Any divergence rolls
 * back the manifest to the prior v1 head and aborts with a loud error.
 */

import type { Argv, ArgumentsCamelCase } from 'yargs';
import { migrateDocToV2, stopBrainNode, listBrainDocs } from '../../lib/brain';
import * as output from '../../lib/output';

interface MigrateToV2Args {
  doc?: string;
  all?: boolean;
}

const CANONICAL_DOCS = [
  'pop.brain.shared',
  'pop.brain.projects',
  'pop.brain.heuristics',
  'pop.brain.retros',
  'pop.brain.brainstorms',
];

export const migrateToV2Handler = {
  builder: (yargs: Argv) => yargs
    .option('doc', {
      type: 'string',
      describe: 'Brain doc id to migrate (e.g. pop.brain.shared). Mutually exclusive with --all.',
    })
    .option('all', {
      type: 'boolean',
      default: false,
      describe: 'Migrate all 5 canonical docs (pop.brain.shared, projects, heuristics, retros, brainstorms).',
    })
    .check((argv: any) => {
      if (!argv.doc && !argv.all) {
        throw new Error('Specify --doc <id> or --all');
      }
      if (argv.doc && argv.all) {
        throw new Error('Use --doc OR --all, not both');
      }
      return true;
    }),

  handler: async (argv: ArgumentsCamelCase<MigrateToV2Args>) => {
    const targets = argv.all ? CANONICAL_DOCS : [argv.doc!];
    const results: Array<{ docId: string; status: string; detail: string }> = [];

    for (const docId of targets) {
      try {
        const r = await migrateDocToV2(docId);
        if (r.action === 'already-v2') {
          results.push({ docId, status: 'noop', detail: `already v2 at ${r.headCid.slice(0, 16)}...` });
        } else if (r.action === 'fresh-init') {
          results.push({ docId, status: 'noop', detail: 'fresh-init / no history to migrate' });
        } else {
          results.push({
            docId,
            status: 'migrated',
            detail: `${r.changeCount} change(s) wrapped → ${r.headCid.slice(0, 16)}...`,
          });
        }
      } catch (err: any) {
        results.push({ docId, status: 'fail', detail: err.message });
      }
    }

    if (output.isJsonMode()) {
      output.json({
        migrated: results.filter(r => r.status === 'migrated').length,
        noop: results.filter(r => r.status === 'noop').length,
        failed: results.filter(r => r.status === 'fail').length,
        results,
      });
    } else {
      console.log('');
      console.log('  pop brain migrate-to-v2');
      console.log('  ' + '─'.repeat(60));
      for (const r of results) {
        const icon = r.status === 'migrated' ? '✓' : r.status === 'noop' ? 'ℹ' : '✗';
        console.log(`  ${icon} ${r.docId.padEnd(28)} ${r.detail}`);
      }
      console.log('');
    }

    await stopBrainNode();

    const hasFailure = results.some(r => r.status === 'fail');
    process.exit(hasFailure ? 1 : 0);
  },
};
