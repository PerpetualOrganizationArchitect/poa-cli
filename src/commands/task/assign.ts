import type { Argv, ArgumentsCamelCase } from 'yargs';
import { createSigner } from '../../lib/signer';
import { createWriteContract } from '../../lib/contracts';
import { executeTx } from '../../lib/tx';
import { parseTaskId } from '../../lib/encoding';
import { requireAddress } from '../../lib/validation';
import * as output from '../../lib/output';
import { resolveOrgContracts } from './helpers';

interface AssignArgs {
  org: string;
  task: string;
  assignee: string;
  chain?: number;
  rpc?: string;
  'private-key'?: string;
  'dry-run'?: boolean;
}

export const assignHandler = {
  builder: (yargs: Argv) => yargs
    .option('task', { type: 'string', demandOption: true, describe: 'Task ID' })
    .option('assignee', { type: 'string', demandOption: true, describe: 'Address to assign to' }),

  handler: async (argv: ArgumentsCamelCase<AssignArgs>) => {
    const assignee = requireAddress(argv.assignee, 'assignee');
    const spin = output.spinner('Assigning task...');
    spin.start();

    try {
      const { taskManagerAddress } = await resolveOrgContracts(argv.org, argv.chain);
      const { signer } = createSigner({ privateKey: argv.privateKey as string, chainId: argv.chain, rpcUrl: argv.rpc as string });

      const contract = createWriteContract(taskManagerAddress, 'TaskManagerNew', signer);
      const parsedTaskId = parseTaskId(argv.task);

      const result = await executeTx(contract, 'assignTask', [parsedTaskId, assignee], { dryRun: argv.dryRun });
      spin.stop();

      if (result.success) {
        output.success(`Task ${argv.task} assigned to ${assignee}`, { txHash: result.txHash, explorerUrl: result.explorerUrl });
      } else {
        output.error('Assignment failed', { error: result.error, errorCode: result.errorCode });
        process.exit(2);
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
