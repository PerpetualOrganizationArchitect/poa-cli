import type { Argv, ArgumentsCamelCase } from 'yargs';
import { createSigner } from '../../lib/signer';
import { createWriteContract } from '../../lib/contracts';
import { executeTx } from '../../lib/tx';
import { parseTaskId } from '../../lib/encoding';
import * as output from '../../lib/output';
import { resolveOrgContracts } from './helpers';

interface ClaimArgs {
  org: string;
  task: string;
  chain?: number;
  rpc?: string;
  'private-key'?: string;
  'dry-run'?: boolean;
}

export const claimHandler = {
  builder: (yargs: Argv) => yargs
    .option('task', { type: 'string', demandOption: true, describe: 'Task ID' }),

  handler: async (argv: ArgumentsCamelCase<ClaimArgs>) => {
    const spin = output.spinner('Claiming task...');
    spin.start();

    try {
      const { taskManagerAddress } = await resolveOrgContracts(argv.org, argv.chain);
      const { signer } = createSigner({ privateKey: argv.privateKey as string, chainId: argv.chain, rpcUrl: argv.rpc as string });

      const contract = createWriteContract(taskManagerAddress, 'TaskManagerNew', signer);
      const parsedTaskId = parseTaskId(argv.task);

      const result = await executeTx(contract, 'claimTask', [parsedTaskId], { dryRun: argv.dryRun });
      spin.stop();

      if (result.success) {
        output.success(`Task ${argv.task} claimed`, { txHash: result.txHash, explorerUrl: result.explorerUrl });
      } else {
        output.error('Claim failed', { error: result.error, errorCode: result.errorCode });
        process.exit(2);
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
