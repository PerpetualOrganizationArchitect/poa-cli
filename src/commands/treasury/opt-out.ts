import type { Argv, ArgumentsCamelCase } from 'yargs';
import { createSigner } from '../../lib/signer';
import { createWriteContract } from '../../lib/contracts';
import { executeTx } from '../../lib/tx';
import * as output from '../../lib/output';
import { resolveTreasuryContracts } from './helpers';

interface OptArgs {
  org?: string;
  chain?: number;
  rpc?: string;
  'private-key'?: string;
  'dry-run'?: boolean;
}

export const optOutHandler = {
  builder: (yargs: Argv) => yargs,
  builderIn: (yargs: Argv) => yargs,

  handler: async (argv: ArgumentsCamelCase<OptArgs>) => {
    const spin = output.spinner('Opting out of distributions...');
    spin.start();

    try {
      const { paymentManagerAddress } = await resolveTreasuryContracts(argv.org, argv.chain);
      const { signer } = createSigner({ privateKey: argv.privateKey as string, chainId: argv.chain, rpcUrl: argv.rpc as string });

      const pm = createWriteContract(paymentManagerAddress, 'PaymentManager', signer);
      const result = await executeTx(pm, 'optOut', [true], { dryRun: argv.dryRun });
      spin.stop();

      if (result.success) {
        output.success('Opted out of distributions', { txHash: result.txHash, explorerUrl: result.explorerUrl });
      } else {
        output.error('Opt-out failed', { error: result.error, errorCode: result.errorCode });
        process.exit(2);
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },

  handlerIn: async (argv: ArgumentsCamelCase<OptArgs>) => {
    const spin = output.spinner('Opting into distributions...');
    spin.start();

    try {
      const { paymentManagerAddress } = await resolveTreasuryContracts(argv.org, argv.chain);
      const { signer } = createSigner({ privateKey: argv.privateKey as string, chainId: argv.chain, rpcUrl: argv.rpc as string });

      const pm = createWriteContract(paymentManagerAddress, 'PaymentManager', signer);
      const result = await executeTx(pm, 'optOut', [false], { dryRun: argv.dryRun });
      spin.stop();

      if (result.success) {
        output.success('Opted into distributions', { txHash: result.txHash, explorerUrl: result.explorerUrl });
      } else {
        output.error('Opt-in failed', { error: result.error, errorCode: result.errorCode });
        process.exit(2);
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
