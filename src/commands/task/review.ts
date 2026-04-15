import type { Argv, ArgumentsCamelCase } from 'yargs';
import { createSigner } from '../../lib/signer';
import { createWriteContract } from '../../lib/contracts';
import { executeTx } from '../../lib/tx';
import { pinJson } from '../../lib/ipfs';
import { parseTaskId, ipfsCidToBytes32 } from '../../lib/encoding';
import {
  argvToIdempotencyString,
  checkIdempotencyCache,
  recordIdempotentResult,
} from '../../lib/idempotency';
import * as output from '../../lib/output';
import { resolveOrgContracts } from './helpers';

interface ReviewArgs {
  org: string;
  task: string;
  action: string;
  reason?: string;
  chain?: number;
  rpc?: string;
  'private-key'?: string;
  'dry-run'?: boolean;
  'idempotency-key'?: string;
  'no-idempotency'?: boolean;
}

export const reviewHandler = {
  builder: (yargs: Argv) => yargs
    .option('task', { type: 'string', demandOption: true, describe: 'Task ID' })
    .option('action', { type: 'string', demandOption: true, choices: ['approve', 'reject'], describe: 'Approve or reject' })
    .option('reason', { type: 'string', describe: 'Rejection reason (required for reject)' })
    .option('idempotency-key', {
      type: 'string',
      describe: 'Task #374 (HB#215): explicit idempotency key. Two reviews of the same task within 15 minutes return the same result without re-submitting.',
    })
    .option('no-idempotency', {
      type: 'boolean',
      default: false,
      describe: 'Bypass the idempotency cache and always submit.',
    }),

  handler: async (argv: ArgumentsCamelCase<ReviewArgs>) => {
    if (argv.action === 'reject' && !argv.reason) {
      output.error('--reason is required when rejecting a task');
      process.exit(1);
      return;
    }

    const spin = output.spinner(`${argv.action === 'approve' ? 'Approving' : 'Rejecting'} task...`);
    spin.start();

    try {
      const { taskManagerAddress, orgId } = await resolveOrgContracts(argv.org, argv.chain);
      const { signer } = createSigner({ privateKey: argv.privateKey as string, chainId: argv.chain, rpcUrl: argv.rpc as string });

      // Task #374: idempotency check
      const idempKey = argv.idempotencyKey || argvToIdempotencyString(argv as Record<string, any>);
      if (!argv.noIdempotency) {
        const cached = checkIdempotencyCache(orgId, 'task.review', idempKey);
        if (cached) {
          spin.stop();
          output.success(`Task ${argv.task} already ${argv.action === 'approve' ? 'approved' : 'rejected'} (idempotency cache hit)`, {
            ...cached,
            cached: true,
            note: 'Prior call within the 15-minute window produced this result. Use --no-idempotency to force re-submit.',
          });
          return;
        }
      }

      const contract = createWriteContract(taskManagerAddress, 'TaskManagerNew', signer);
      const parsedTaskId = parseTaskId(argv.task);

      let result;
      if (argv.action === 'approve') {
        result = await executeTx(contract, 'completeTask', [parsedTaskId], { dryRun: argv.dryRun });
      } else {
        // Upload rejection reason to IPFS
        const rejectionMetadata = { rejection: argv.reason };
        spin.text = 'Pinning rejection reason to IPFS...';
        const cid = await pinJson(JSON.stringify(rejectionMetadata));
        const rejectionHash = ipfsCidToBytes32(cid);

        spin.text = 'Sending transaction...';
        result = await executeTx(contract, 'rejectTask', [parsedTaskId, rejectionHash], { dryRun: argv.dryRun });
      }

      spin.stop();

      if (result.success) {
        if (!argv.noIdempotency) {
          recordIdempotentResult(orgId, 'task.review', idempKey, {
            taskId: argv.task,
            action: argv.action,
            txHash: result.txHash,
          });
        }
        output.success(`Task ${argv.task} ${argv.action === 'approve' ? 'approved' : 'rejected'}`, { txHash: result.txHash, explorerUrl: result.explorerUrl });
      } else {
        output.error('Review failed', { error: result.error, errorCode: result.errorCode });
        process.exit(2);
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
