import type { Argv, ArgumentsCamelCase } from 'yargs';
import { createSigner } from '../../lib/signer';
import { createWriteContract } from '../../lib/contracts';
import { executeTx } from '../../lib/tx';
import * as output from '../../lib/output';
import { resolveTokenAddress } from './helpers';

interface CancelArgs {
  org?: string;
  request: number;
  chain?: number;
  rpc?: string;
  'private-key'?: string;
  'dry-run'?: boolean;
}

export const cancelHandler = {
  builder: (yargs: Argv) => yargs
    .option('request', { type: 'number', demandOption: true, describe: 'Request ID to cancel' }),

  handler: async (argv: ArgumentsCamelCase<CancelArgs>) => {
    const spin = output.spinner('Cancelling token request...');
    spin.start();

    try {
      const { tokenAddress } = await resolveTokenAddress(argv.org, argv.chain);
      const { signer } = createSigner({ privateKey: argv.privateKey as string, chainId: argv.chain, rpcUrl: argv.rpc as string });

      const contract = createWriteContract(tokenAddress, 'ParticipationToken', signer);
      const result = await executeTx(contract, 'cancelRequest', [argv.request], { dryRun: argv.dryRun });
      spin.stop();

      if (result.success) {
        output.success(`Request #${argv.request} cancelled`, { txHash: result.txHash, explorerUrl: result.explorerUrl });
      } else {
        output.error('Cancel failed', { error: result.error, errorCode: result.errorCode });
        process.exit(2);
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
