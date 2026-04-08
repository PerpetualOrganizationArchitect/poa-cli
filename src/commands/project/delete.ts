import type { Argv, ArgumentsCamelCase } from 'yargs';
import { createSigner } from '../../lib/signer';
import { createWriteContract } from '../../lib/contracts';
import { executeTx } from '../../lib/tx';
import { parseProjectId } from '../../lib/encoding';
import * as output from '../../lib/output';
import { resolveOrgContracts } from '../task/helpers';

interface DeleteArgs {
  org: string;
  project: string;
  chain?: number;
  rpc?: string;
  'private-key'?: string;
  'dry-run'?: boolean;
}

export const deleteHandler = {
  builder: (yargs: Argv) => yargs
    .option('project', { type: 'string', demandOption: true, describe: 'Project ID' }),

  handler: async (argv: ArgumentsCamelCase<DeleteArgs>) => {
    const spin = output.spinner('Deleting project...');
    spin.start();

    try {
      const { taskManagerAddress } = await resolveOrgContracts(argv.org, argv.chain);
      const { signer } = createSigner({ privateKey: argv.privateKey as string, chainId: argv.chain, rpcUrl: argv.rpc as string });

      const contract = createWriteContract(taskManagerAddress, 'TaskManagerNew', signer);
      const pid = parseProjectId(argv.project);

      const result = await executeTx(contract, 'deleteProject', [pid], { dryRun: argv.dryRun });
      spin.stop();

      if (result.success) {
        output.success('Project deleted', { txHash: result.txHash, explorerUrl: result.explorerUrl });
      } else {
        output.error('Project deletion failed', { error: result.error, errorCode: result.errorCode });
        process.exit(2);
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
