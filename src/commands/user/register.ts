import type { Argv, ArgumentsCamelCase } from 'yargs';
import { createSigner } from '../../lib/signer';
import { createWriteContract } from '../../lib/contracts';
import { executeTx } from '../../lib/tx';
import { query } from '../../lib/subgraph';
import { FETCH_INFRASTRUCTURE_ADDRESSES } from '../../queries/infrastructure';
import type { InfrastructureAddresses } from '../../queries/infrastructure';
import { HOME_CHAIN_ID } from '../../config/networks';
import * as output from '../../lib/output';

interface RegisterArgs {
  username: string;
  chain?: number;
  rpc?: string;
  'private-key'?: string;
  'dry-run'?: boolean;
}

export const registerHandler = {
  builder: (yargs: Argv) => yargs
    .option('username', { type: 'string', demandOption: true, describe: 'Username (3-32 chars, alphanumeric + underscores)' }),

  handler: async (argv: ArgumentsCamelCase<RegisterArgs>) => {
    // Validate username
    const username = argv.username;
    if (username.length < 3 || username.length > 32) {
      output.error('Username must be 3-32 characters');
      process.exit(1);
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      output.error('Username can only contain letters, numbers, and underscores');
      process.exit(1);
      return;
    }

    const spin = output.spinner('Registering username...');
    spin.start();

    try {
      // Usernames live on the home chain (Arbitrum)
      const chainId = argv.chain || HOME_CHAIN_ID;
      const { signer } = createSigner({ privateKey: argv.privateKey as string, chainId, rpcUrl: argv.rpc as string });

      // Resolve UniversalAccountRegistry address
      const infra = await query<InfrastructureAddresses>(
        FETCH_INFRASTRUCTURE_ADDRESSES,
        {},
        chainId
      );

      const registryAddr = infra.universalAccountRegistries?.[0]?.id
        || infra.poaManagerContracts?.[0]?.globalAccountRegistryProxy;
      if (!registryAddr) {
        throw new Error('Could not resolve UniversalAccountRegistry address');
      }

      spin.text = 'Sending registration transaction...';
      const contract = createWriteContract(registryAddr, 'UniversalAccountRegistry', signer);
      const result = await executeTx(contract, 'registerAccount', [username], { dryRun: argv.dryRun });
      spin.stop();

      if (result.success) {
        output.success(`Username "${username}" registered`, {
          txHash: result.txHash, explorerUrl: result.explorerUrl,
          address: signer.address,
          chain: chainId,
        });
      } else {
        output.error('Registration failed', { error: result.error, errorCode: result.errorCode });
        process.exit(2);
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
