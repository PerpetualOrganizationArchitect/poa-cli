import type { Argv, ArgumentsCamelCase } from 'yargs';
import { createSigner } from '../../lib/signer';
import { createWriteContract } from '../../lib/contracts';
import { executeTx } from '../../lib/tx';
import { requireAddress } from '../../lib/validation';
import * as output from '../../lib/output';
import { resolveEligibilityModule } from './helpers';

interface RevokeArgs {
  org?: string;
  address: string;
  hat: string;
  chain?: number;
  rpc?: string;
  'private-key'?: string;
  'dry-run'?: boolean;
}

export const revokeHandler = {
  builder: (yargs: Argv) => yargs
    .option('address', { type: 'string', demandOption: true, describe: 'Address whose vouch to revoke' })
    .option('hat', { type: 'string', demandOption: true, describe: 'Hat ID of the role' }),

  handler: async (argv: ArgumentsCamelCase<RevokeArgs>) => {
    const wearer = requireAddress(argv.address, 'address');
    const spin = output.spinner('Revoking vouch...');
    spin.start();

    try {
      const { eligibilityModuleAddress } = await resolveEligibilityModule(argv.org, argv.chain);
      const { signer } = createSigner({ privateKey: argv.privateKey as string, chainId: argv.chain, rpcUrl: argv.rpc as string });

      const contract = createWriteContract(eligibilityModuleAddress, 'EligibilityModuleNew', signer);
      const result = await executeTx(contract, 'revokeVouch', [wearer, argv.hat], { dryRun: argv.dryRun });
      spin.stop();

      if (result.success) {
        output.success(`Vouch revoked for ${wearer} on hat ${argv.hat}`, { txHash: result.txHash, explorerUrl: result.explorerUrl });
      } else {
        output.error('Revoke failed', { error: result.error, errorCode: result.errorCode });
        process.exit(2);
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
