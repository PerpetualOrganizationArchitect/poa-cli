import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import { createProvider } from '../../lib/signer';
import { createReadContract } from '../../lib/contracts';
import * as output from '../../lib/output';
import { resolveTokenAddress } from './helpers';

interface BalanceArgs {
  org?: string;
  address?: string;
  chain?: number;
  rpc?: string;
  'private-key'?: string;
}

export const balanceHandler = {
  builder: (yargs: Argv) => yargs
    .option('address', { type: 'string', describe: 'Address to check (defaults to signer)' }),

  handler: async (argv: ArgumentsCamelCase<BalanceArgs>) => {
    const spin = output.spinner('Checking balance...');
    spin.start();

    try {
      const address = argv.address || (() => {
        const key = argv.privateKey as string || process.env.POP_PRIVATE_KEY;
        if (!key) throw new Error('Provide --address or --private-key to identify user');
        return new ethers.Wallet(key).address;
      })();

      const { tokenAddress } = await resolveTokenAddress(argv.org, argv.chain);
      const provider = createProvider({ chainId: argv.chain, rpcUrl: argv.rpc as string });
      const contract = createReadContract(tokenAddress, 'ParticipationToken', provider);

      const balance = await contract.balanceOf(address);
      const formatted = ethers.utils.formatUnits(balance, 18);

      spin.stop();

      if (output.isJsonMode()) {
        output.json({ address, balance: formatted, balanceWei: balance.toString(), token: tokenAddress });
      } else {
        console.log(`\n  ${address}: ${formatted} PT\n`);
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
