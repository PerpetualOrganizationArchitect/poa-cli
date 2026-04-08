import type { Argv, ArgumentsCamelCase } from 'yargs';
import { createSigner } from '../../lib/signer';
import { createWriteContract } from '../../lib/contracts';
import { executeTx } from '../../lib/tx';
import { pinJson } from '../../lib/ipfs';
import { parseTaskId, ipfsCidToBytes32 } from '../../lib/encoding';
import * as output from '../../lib/output';
import { resolveOrgContracts } from './helpers';

interface SubmitArgs {
  org: string;
  task: string;
  submission: string;
  chain?: number;
  rpc?: string;
  'private-key'?: string;
  'dry-run'?: boolean;
}

export const submitHandler = {
  builder: (yargs: Argv) => yargs
    .option('task', { type: 'string', demandOption: true, describe: 'Task ID' })
    .option('submission', { type: 'string', demandOption: true, describe: 'Submission text' }),

  handler: async (argv: ArgumentsCamelCase<SubmitArgs>) => {
    const spin = output.spinner('Submitting task...');
    spin.start();

    try {
      const { taskManagerAddress } = await resolveOrgContracts(argv.org, argv.chain);
      const { signer } = createSigner({ privateKey: argv.privateKey as string, chainId: argv.chain, rpcUrl: argv.rpc as string });

      // Build submission metadata (same shape as task metadata, with submission field populated)
      // The frontend re-uses the task metadata shape for submissions
      const submissionMetadata = {
        name: '',
        description: '',
        location: '',
        difficulty: '',
        estHours: 0,
        submission: argv.submission,
      };

      spin.text = 'Pinning submission to IPFS...';
      const cid = await pinJson(JSON.stringify(submissionMetadata));
      const submissionHash = ipfsCidToBytes32(cid);

      spin.text = 'Sending transaction...';
      const contract = createWriteContract(taskManagerAddress, 'TaskManagerNew', signer);
      const parsedTaskId = parseTaskId(argv.task);
      const result = await executeTx(contract, 'submitTask', [parsedTaskId, submissionHash], { dryRun: argv.dryRun });
      spin.stop();

      if (result.success) {
        output.success(`Task ${argv.task} submitted`, { txHash: result.txHash, explorerUrl: result.explorerUrl, ipfsCid: cid });
      } else {
        output.error('Submission failed', { error: result.error, errorCode: result.errorCode });
        process.exit(2);
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
