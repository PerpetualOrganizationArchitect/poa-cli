import type { Argv, ArgumentsCamelCase } from 'yargs';
import { createSigner } from '../../lib/signer';
import { createWriteContract } from '../../lib/contracts';
import { executeTx } from '../../lib/tx';
import * as output from '../../lib/output';
import { resolveEligibilityModule } from './helpers';

interface ClaimArgs {
  org?: string;
  hat: string;
  chain?: number;
  rpc?: string;
  'private-key'?: string;
  'dry-run'?: boolean;
}

export const claimHandler = {
  builder: (yargs: Argv) => yargs
    .option('hat', { type: 'string', demandOption: true, describe: 'Hat ID to claim' }),

  handler: async (argv: ArgumentsCamelCase<ClaimArgs>) => {
    const spin = output.spinner('Claiming hat...');
    spin.start();

    try {
      const { eligibilityModuleAddress } = await resolveEligibilityModule(argv.org, argv.chain);
      const { signer } = createSigner({ privateKey: argv.privateKey as string, chainId: argv.chain, rpcUrl: argv.rpc as string });

      const contract = createWriteContract(eligibilityModuleAddress, 'EligibilityModuleNew', signer);
      const result = await executeTx(contract, 'claimVouchedHat', [argv.hat], { dryRun: argv.dryRun });
      spin.stop();

      if (result.success) {
        output.success(`Hat ${argv.hat} claimed`, { txHash: result.txHash, explorerUrl: result.explorerUrl });
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
