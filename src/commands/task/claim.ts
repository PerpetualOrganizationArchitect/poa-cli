import type { Argv, ArgumentsCamelCase } from 'yargs';
import { createSigner } from '../../lib/signer';
import { createWriteContract } from '../../lib/contracts';
import { executeTx } from '../../lib/tx';
import { parseTaskId } from '../../lib/encoding';
import { query } from '../../lib/subgraph';
import {
  argvToIdempotencyString,
  checkIdempotencyCache,
  recordIdempotentResult,
} from '../../lib/idempotency';
import * as output from '../../lib/output';
import { resolveOrgContracts } from './helpers';

interface ClaimArgs {
  org: string;
  task: string;
  chain?: number;
  rpc?: string;
  'private-key'?: string;
  'dry-run'?: boolean;
  'idempotency-key'?: string;
  'no-idempotency'?: boolean;
}

export const claimHandler = {
  builder: (yargs: Argv) => yargs
    .option('task', { type: 'string', demandOption: true, describe: 'Task ID' })
    .option('idempotency-key', {
      type: 'string',
      describe: 'Task #370 (HB#214): explicit idempotency key. Two claims for the same task within 15 minutes return the same result without re-submitting. Default: auto-derived from argv.',
    })
    .option('no-idempotency', {
      type: 'boolean',
      default: false,
      describe: 'Bypass the idempotency cache and always submit.',
    }),

  handler: async (argv: ArgumentsCamelCase<ClaimArgs>) => {
    const spin = output.spinner('Claiming task...');
    spin.start();

    try {
      const { taskManagerAddress, orgId } = await resolveOrgContracts(argv.org, argv.chain);
      const { signer } = createSigner({ privateKey: argv.privateKey as string, chainId: argv.chain, rpcUrl: argv.rpc as string });

      // Task #370: idempotency check before submitting
      const idempKey = argv.idempotencyKey || argvToIdempotencyString(argv as Record<string, any>);
      if (!argv.noIdempotency) {
        const cached = checkIdempotencyCache(orgId, 'task.claim', idempKey);
        if (cached) {
          spin.stop();
          output.success(`Task ${argv.task} already claimed (idempotency cache hit)`, {
            ...cached,
            cached: true,
            note: 'Prior call within the 15-minute window produced this result. Use --no-idempotency to force re-submit.',
          });
          return;
        }
      }

      const contract = createWriteContract(taskManagerAddress, 'TaskManagerNew', signer);
      const parsedTaskId = parseTaskId(argv.task);

      const result = await executeTx(contract, 'claimTask', [parsedTaskId], { dryRun: argv.dryRun });
      spin.stop();

      if (result.success) {
        if (!argv.noIdempotency) {
          recordIdempotentResult(orgId, 'task.claim', idempKey, {
            taskId: argv.task,
            txHash: result.txHash,
          });
        }
        output.success(`Task ${argv.task} claimed`, { txHash: result.txHash, explorerUrl: result.explorerUrl });
      } else {
        // When the contract rejects with BadStatus, enrich the error with the
        // task's actual on-chain state so the operator knows why it's rejected.
        // Common BadStatus causes: task already claimed, cancelled, submitted, completed.
        let enrichment = '';
        if (result.error?.includes('BadStatus')) {
          try {
            const q = `{ tasks(where: { taskManager: "${taskManagerAddress.toLowerCase()}", taskId: "${parsedTaskId}" }, first: 1) { status assigneeUsername completerUsername } }`;
            const taskData = await query<any>(q, {}, argv.chain);
            const task = taskData.tasks?.[0];
            if (task) {
              const owner = task.assigneeUsername || task.completerUsername || '(none)';
              enrichment = ` — task is ${task.status}${task.status !== 'Open' ? ', held by ' + owner : ''}`;
            }
          } catch { /* non-critical enrichment */ }
        }
        output.error('Claim failed' + enrichment, { error: result.error, errorCode: result.errorCode });
        process.exit(2);
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
