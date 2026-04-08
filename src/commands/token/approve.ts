import type { Argv, ArgumentsCamelCase } from 'yargs';
import { createSigner } from '../../lib/signer';
import { createWriteContract } from '../../lib/contracts';
import { executeTx } from '../../lib/tx';
import * as output from '../../lib/output';
import { resolveTokenAddress } from './helpers';

interface ApproveArgs {
  org?: string;
  request: number;
  chain?: number;
  rpc?: string;
  'private-key'?: string;
  'dry-run'?: boolean;
}

export const approveHandler = {
  builder: (yargs: Argv) => yargs
    .option('request', { type: 'number', demandOption: true, describe: 'Request ID to approve' }),

  handler: async (argv: ArgumentsCamelCase<ApproveArgs>) => {
    const spin = output.spinner('Approving token request...');
    spin.start();

    try {
      const { tokenAddress } = await resolveTokenAddress(argv.org, argv.chain);
      const { signer } = createSigner({ privateKey: argv.privateKey as string, chainId: argv.chain, rpcUrl: argv.rpc as string });

      const contract = createWriteContract(tokenAddress, 'ParticipationToken', signer);
      const result = await executeTx(contract, 'approveRequest', [argv.request], { dryRun: argv.dryRun });
      spin.stop();

      if (result.success) {
        output.success(`Request #${argv.request} approved`, { txHash: result.txHash, explorerUrl: result.explorerUrl });
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
