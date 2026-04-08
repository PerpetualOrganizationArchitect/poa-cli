import type { Argv, ArgumentsCamelCase } from 'yargs';
import { createSigner } from '../../lib/signer';
import { createWriteContract } from '../../lib/contracts';
import { executeTx } from '../../lib/tx';
import { parseTaskId } from '../../lib/encoding';
import { requireAddress } from '../../lib/validation';
import * as output from '../../lib/output';
import { resolveOrgContracts } from './helpers';

interface ApproveAppArgs {
  org: string;
  task: string;
  applicant: string;
  chain?: number;
  rpc?: string;
  'private-key'?: string;
  'dry-run'?: boolean;
}

export const approveAppHandler = {
  builder: (yargs: Argv) => yargs
    .option('task', { type: 'string', demandOption: true, describe: 'Task ID' })
    .option('applicant', { type: 'string', demandOption: true, describe: 'Applicant address to approve' }),

  handler: async (argv: ArgumentsCamelCase<ApproveAppArgs>) => {
    const applicant = requireAddress(argv.applicant, 'applicant');
    const spin = output.spinner('Approving application...');
    spin.start();

    try {
      const { taskManagerAddress } = await resolveOrgContracts(argv.org, argv.chain);
      const { signer } = createSigner({ privateKey: argv.privateKey as string, chainId: argv.chain, rpcUrl: argv.rpc as string });

      const contract = createWriteContract(taskManagerAddress, 'TaskManagerNew', signer);
      const parsedTaskId = parseTaskId(argv.task);

      const result = await executeTx(contract, 'approveApplication', [parsedTaskId, applicant], { dryRun: argv.dryRun });
      spin.stop();

      if (result.success) {
        output.success(`Application approved for task ${argv.task}`, { txHash: result.txHash, explorerUrl: result.explorerUrl, applicant });
      } else {
        output.error('Approval failed', { error: result.error, errorCode: result.errorCode });
        process.exit(2);
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
