import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import { createSigner } from '../../lib/signer';
import { createWriteContract } from '../../lib/contracts';
import { executeTx } from '../../lib/tx';
import * as output from '../../lib/output';
import { resolveTreasuryContracts } from './helpers';

interface ClaimArgs {
  org?: string;
  distribution: number;
  amount: string;
  proof: string;
  chain?: number;
  rpc?: string;
  'private-key'?: string;
  'dry-run'?: boolean;
}

export const claimHandler = {
  builder: (yargs: Argv) => yargs
    .option('distribution', { type: 'number', demandOption: true, describe: 'Distribution ID' })
    .option('amount', { type: 'string', demandOption: true, describe: 'Claim amount (wei)' })
    .option('proof', { type: 'string', demandOption: true, describe: 'JSON array of merkle proof bytes32 hashes' }),

  handler: async (argv: ArgumentsCamelCase<ClaimArgs>) => {
    const spin = output.spinner('Claiming distribution...');
    spin.start();

    try {
      let proofArray: string[];
      try {
        proofArray = JSON.parse(argv.proof);
        if (!Array.isArray(proofArray)) throw new Error('not an array');
      } catch {
        throw new Error('--proof must be a JSON array of bytes32 hex strings');
      }

      const { paymentManagerAddress } = await resolveTreasuryContracts(argv.org, argv.chain);
      const { signer } = createSigner({ privateKey: argv.privateKey as string, chainId: argv.chain, rpcUrl: argv.rpc as string });

      const pm = createWriteContract(paymentManagerAddress, 'PaymentManager', signer);
      const result = await executeTx(
        pm,
        'claimDistribution',
        [argv.distribution, ethers.BigNumber.from(argv.amount), proofArray],
        { dryRun: argv.dryRun }
      );
      spin.stop();

      if (result.success) {
        output.success(`Claimed from distribution #${argv.distribution}`, {
          amount: argv.amount,
          txHash: result.txHash,
          explorerUrl: result.explorerUrl,
        });
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
