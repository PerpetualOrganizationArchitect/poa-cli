import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import { resolveOrgModules } from '../../lib/resolve';
import { resolveNetworkConfig, getNetworkByChainId } from '../../config/networks';
import * as output from '../../lib/output';

interface BalanceArgs {
  org?: string;
  chain?: number;
}

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
];

export const balanceHandler = {
  builder: (yargs: Argv) => yargs,

  handler: async (argv: ArgumentsCamelCase<BalanceArgs>) => {
    const spin = output.spinner('Fetching treasury balances...');
    spin.start();

    try {
      const modules = await resolveOrgModules(argv.org, argv.chain);
      const networkConfig = resolveNetworkConfig(argv.chain);
      const provider = new ethers.providers.JsonRpcProvider(networkConfig.resolvedRpc);
      const network = getNetworkByChainId(networkConfig.chainId);

      const executorAddr = modules.executorAddress;
      const paymentManagerAddr = modules.paymentManagerAddress;

      // Collect all known bounty tokens for this chain
      const bountyTokens = network?.bountyTokens || {};
      const tokenAddresses = Object.values(bountyTokens);

      // Also check native balance
      const holdings: Array<{
        token: string;
        symbol: string;
        executor: string;
        paymentManager: string;
        total: string;
      }> = [];

      // Native balance (xDAI on Gnosis)
      const [execNative, pmNative] = await Promise.all([
        executorAddr ? provider.getBalance(executorAddr) : ethers.BigNumber.from(0),
        paymentManagerAddr ? provider.getBalance(paymentManagerAddr) : ethers.BigNumber.from(0),
      ]);
      const nativeSymbol = network?.nativeCurrency?.symbol || 'ETH';
      holdings.push({
        token: 'native',
        symbol: nativeSymbol,
        executor: ethers.utils.formatEther(execNative),
        paymentManager: ethers.utils.formatEther(pmNative),
        total: ethers.utils.formatEther(execNative.add(pmNative)),
      });

      // ERC20 balances
      for (const addr of tokenAddresses) {
        const contract = new ethers.Contract(addr, ERC20_ABI, provider);
        try {
          const [sym, dec, execBal, pmBal] = await Promise.all([
            contract.symbol(),
            contract.decimals(),
            executorAddr ? contract.balanceOf(executorAddr) : ethers.BigNumber.from(0),
            paymentManagerAddr ? contract.balanceOf(paymentManagerAddr) : ethers.BigNumber.from(0),
          ]);
          holdings.push({
            token: addr,
            symbol: sym,
            executor: ethers.utils.formatUnits(execBal, dec),
            paymentManager: ethers.utils.formatUnits(pmBal, dec),
            total: ethers.utils.formatUnits(execBal.add(pmBal), dec),
          });
        } catch {
          // Skip tokens that fail to query
        }
      }

      spin.stop();

      if (output.isJsonMode()) {
        output.json({
          executor: executorAddr,
          paymentManager: paymentManagerAddr,
          holdings,
        });
      } else {
        console.log('');
        console.log('  Treasury Balances');
        console.log('  ' + '─'.repeat(50));
        if (executorAddr) console.log(`  Executor:        ${executorAddr}`);
        if (paymentManagerAddr) console.log(`  PaymentManager:  ${paymentManagerAddr}`);
        console.log('');

        const rows = holdings
          .filter(h => parseFloat(h.total) > 0)
          .map(h => [h.symbol, h.total, h.executor, h.paymentManager]);

        if (rows.length === 0) {
          console.log('  No token holdings found');
        } else {
          output.table(['Token', 'Total', 'Executor', 'PaymentManager'], rows);
        }
        console.log('');
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
