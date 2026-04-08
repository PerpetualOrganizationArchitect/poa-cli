import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import { createProvider } from '../../lib/signer';
import { createReadContract } from '../../lib/contracts';
import { requireAddress } from '../../lib/validation';
import * as output from '../../lib/output';
import { resolveEligibilityModule } from './helpers';

interface StatusArgs {
  org?: string;
  hat: string;
  address: string;
  chain?: number;
  rpc?: string;
}

export const statusHandler = {
  builder: (yargs: Argv) => yargs
    .option('hat', { type: 'string', demandOption: true, describe: 'Hat ID to check' })
    .option('address', { type: 'string', demandOption: true, describe: 'Wearer address to check' }),

  handler: async (argv: ArgumentsCamelCase<StatusArgs>) => {
    const wearer = requireAddress(argv.address, 'address');
    const spin = output.spinner('Checking vouch status...');
    spin.start();

    try {
      const { eligibilityModuleAddress } = await resolveEligibilityModule(argv.org, argv.chain);
      const provider = createProvider({ chainId: argv.chain, rpcUrl: argv.rpc as string });
      const contract = createReadContract(eligibilityModuleAddress, 'EligibilityModuleNew', provider);

      const [vouchCount, isEnabled, vouchConfig] = await Promise.all([
        contract.currentVouchCount(argv.hat, wearer),
        contract.isVouchingEnabled(argv.hat),
        contract.vouchConfigs(argv.hat),
      ]);

      spin.stop();

      const quorum = vouchConfig?.quorum?.toString() || '?';
      const data = {
        hat: argv.hat,
        wearer,
        vouchingEnabled: isEnabled,
        currentVouches: vouchCount.toString(),
        requiredVouches: quorum,
        canClaim: isEnabled && vouchCount.gte(vouchConfig?.quorum || 0),
      };

      if (output.isJsonMode()) {
        output.json(data);
      } else {
        console.log('');
        console.log(`  Hat:              ${argv.hat}`);
        console.log(`  Wearer:           ${wearer}`);
        console.log(`  Vouching enabled: ${isEnabled ? 'yes' : 'no'}`);
        console.log(`  Vouches:          ${vouchCount.toString()} / ${quorum}`);
        console.log(`  Can claim:        ${data.canClaim ? 'yes' : 'no'}`);
        console.log('');
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
