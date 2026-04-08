import type { Argv, ArgumentsCamelCase } from 'yargs';
import { createSigner } from '../../lib/signer';
import { createWriteContract } from '../../lib/contracts';
import { executeTx } from '../../lib/tx';
import { requireAddress } from '../../lib/validation';
import * as output from '../../lib/output';
import { resolveEligibilityModule } from './helpers';

interface ForArgs {
  org?: string;
  address: string;
  hat: string;
  chain?: number;
  rpc?: string;
  'private-key'?: string;
  'dry-run'?: boolean;
}

export const forHandler = {
  builder: (yargs: Argv) => yargs
    .option('address', { type: 'string', demandOption: true, describe: 'Address of the user to vouch for' })
    .option('hat', { type: 'string', demandOption: true, describe: 'Hat ID of the role' }),

  handler: async (argv: ArgumentsCamelCase<ForArgs>) => {
    const wearer = requireAddress(argv.address, 'address');
    const hatId = argv.hat;

    const spin = output.spinner('Vouching...');
    spin.start();

    try {
      const { eligibilityModuleAddress } = await resolveEligibilityModule(argv.org, argv.chain);
      const { signer } = createSigner({ privateKey: argv.privateKey as string, chainId: argv.chain, rpcUrl: argv.rpc as string });

      const contract = createWriteContract(eligibilityModuleAddress, 'EligibilityModuleNew', signer);
      const result = await executeTx(contract, 'vouchFor', [wearer, hatId], { dryRun: argv.dryRun });
      spin.stop();

      if (result.success) {
        output.success(`Vouched for ${wearer} on hat ${hatId}`, { txHash: result.txHash, explorerUrl: result.explorerUrl });
      } else {
        output.error('Vouch failed', { error: result.error, errorCode: result.errorCode });
        process.exit(2);
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
