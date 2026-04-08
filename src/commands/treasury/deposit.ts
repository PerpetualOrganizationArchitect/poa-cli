import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import { createSigner } from '../../lib/signer';
import { createWriteContract } from '../../lib/contracts';
import { executeTx } from '../../lib/tx';
import { requireAddress } from '../../lib/validation';
import { getTokenDecimals } from '../../config/tokens';
import * as output from '../../lib/output';
import { resolveTreasuryContracts } from './helpers';

interface DepositArgs {
  org?: string;
  token: string;
  amount: number;
  chain?: number;
  rpc?: string;
  'private-key'?: string;
  'dry-run'?: boolean;
}

export const depositHandler = {
  builder: (yargs: Argv) => yargs
    .option('token', { type: 'string', demandOption: true, describe: 'ERC20 token address' })
    .option('amount', { type: 'number', demandOption: true, describe: 'Amount to deposit' }),

  handler: async (argv: ArgumentsCamelCase<DepositArgs>) => {
    const tokenAddr = requireAddress(argv.token, 'token');
    const spin = output.spinner('Depositing to treasury...');
    spin.start();

    try {
      const { paymentManagerAddress } = await resolveTreasuryContracts(argv.org, argv.chain);
      const { signer } = createSigner({ privateKey: argv.privateKey as string, chainId: argv.chain, rpcUrl: argv.rpc as string });

      const decimals = getTokenDecimals(tokenAddr);
      const amountWei = ethers.utils.parseUnits(argv.amount.toString(), decimals);

      // Step 1: Approve ERC20 spend
      spin.text = 'Approving token spend...';
      const erc20 = createWriteContract(tokenAddr, 'ERC20', signer);
      const approveResult = await executeTx(erc20, 'approve', [paymentManagerAddress, amountWei], { dryRun: argv.dryRun });

      if (!approveResult.success) {
        spin.stop();
        output.error('Token approval failed', { error: approveResult.error, errorCode: approveResult.errorCode });
        process.exit(2);
        return;
      }

      // Step 2: Deposit via payERC20
      spin.text = 'Depositing tokens...';
      const pm = createWriteContract(paymentManagerAddress, 'PaymentManager', signer);
      const result = await executeTx(pm, 'payERC20', [tokenAddr, amountWei], { dryRun: argv.dryRun });
      spin.stop();

      if (result.success) {
        output.success('Deposit successful', {
          amount: `${argv.amount}`,
          token: tokenAddr,
          txHash: result.txHash,
          explorerUrl: result.explorerUrl,
        });
      } else {
        output.error('Deposit failed', { error: result.error, errorCode: result.errorCode });
        process.exit(2);
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
