import type { Argv, ArgumentsCamelCase } from 'yargs';
import { createSigner } from '../../lib/signer';
import { createWriteContract } from '../../lib/contracts';
import { executeTx } from '../../lib/tx';
import { resolveOrgModules, requireModule } from '../../lib/resolve';
import * as output from '../../lib/output';

interface JoinArgs {
  org: string;
  username?: string;
  chain?: number;
  rpc?: string;
  'private-key'?: string;
  'dry-run'?: boolean;
}

export const joinHandler = {
  builder: (yargs: Argv) => yargs
    .option('username', { type: 'string', describe: 'Username to register (if not already registered)' }),

  handler: async (argv: ArgumentsCamelCase<JoinArgs>) => {
    const spin = output.spinner('Joining organization...');
    spin.start();

    try {
      const modules = await resolveOrgModules(argv.org, argv.chain);
      const quickJoinAddr = requireModule(modules, 'quickJoinAddress');
      const orgId = modules.orgId;
      const { signer } = createSigner({ privateKey: argv.privateKey as string, chainId: argv.chain, rpcUrl: argv.rpc as string });

      spin.text = 'Sending join transaction...';
      const contract = createWriteContract(quickJoinAddr, 'QuickJoinNew', signer);

      // If user already has an account, use quickJoinWithUser
      // The contract will handle the membership hat minting
      const result = await executeTx(contract, 'quickJoinWithUser', [], { dryRun: argv.dryRun });

      spin.stop();

      if (result.success) {
        output.success(`Joined organization`, {
          txHash: result.txHash, explorerUrl: result.explorerUrl,
          orgId,
        });
      } else {
        output.error('Join failed', { error: result.error, errorCode: result.errorCode });
        process.exit(2);
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
