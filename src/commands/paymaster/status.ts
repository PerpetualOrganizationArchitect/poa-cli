import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import { query } from '../../lib/subgraph';
import { resolveOrgId } from '../../lib/resolve';
import { createReadContract } from '../../lib/contracts';
import { resolveNetworkConfig } from '../../config/networks';
import { FETCH_INFRASTRUCTURE_ADDRESSES } from '../../queries/infrastructure';
import type { InfrastructureAddresses } from '../../queries/infrastructure';
import * as output from '../../lib/output';

interface StatusArgs {
  org?: string;
  chain?: number;
}

export const statusHandler = {
  builder: (yargs: Argv) => yargs,

  handler: async (argv: ArgumentsCamelCase<StatusArgs>) => {
    const spin = output.spinner('Fetching paymaster status...');
    spin.start();

    try {
      const orgId = await resolveOrgId(argv.org, argv.chain);
      const networkConfig = resolveNetworkConfig(argv.chain);
      const provider = new ethers.providers.JsonRpcProvider(networkConfig.resolvedRpc);

      // Get PaymasterHub address
      const infra = await query<InfrastructureAddresses>(
        FETCH_INFRASTRUCTURE_ADDRESSES,
        {},
        argv.chain
      );
      const paymasterAddr = infra.poaManagerContracts?.[0]?.paymasterHubProxy;
      if (!paymasterAddr) {
        spin.stop();
        output.error('PaymasterHub not found');
        process.exit(1);
        return;
      }

      const paymaster = createReadContract(paymasterAddr, 'PaymasterHub', provider);

      // Query on-chain state
      const [entryPoint, feeCaps, orgConfig] = await Promise.all([
        paymaster.ENTRY_POINT(),
        paymaster.getFeeCaps(orgId),
        paymaster.getOrgConfig(orgId),
      ]);

      // Check EntryPoint deposit
      const ep = new ethers.Contract(
        entryPoint,
        ['function balanceOf(address) view returns (uint256)'],
        provider
      );
      const deposit = await ep.balanceOf(paymasterAddr);

      const isPaused = orgConfig[4]; // paused flag

      spin.stop();

      if (output.isJsonMode()) {
        output.json({
          paymasterHub: paymasterAddr,
          entryPoint,
          deposit: ethers.utils.formatEther(deposit),
          maxFeePerGas: ethers.utils.formatUnits(feeCaps.maxFeePerGas, 'gwei'),
          maxPriorityFeePerGas: ethers.utils.formatUnits(feeCaps.maxPriorityFeePerGas, 'gwei'),
          paused: isPaused,
        });
      } else {
        console.log('');
        console.log('  Paymaster Status');
        console.log('  ' + '─'.repeat(40));
        console.log(`  Hub:          ${paymasterAddr}`);
        console.log(`  EntryPoint:   ${entryPoint}`);
        console.log(`  Deposit:      ${ethers.utils.formatEther(deposit)} xDAI`);
        console.log(`  Max Fee:      ${ethers.utils.formatUnits(feeCaps.maxFeePerGas, 'gwei')} gwei`);
        console.log(`  Max Priority: ${ethers.utils.formatUnits(feeCaps.maxPriorityFeePerGas, 'gwei')} gwei`);
        console.log(`  Paused:       ${isPaused ? 'YES' : 'no'}`);
        console.log('');
        console.log('  Note: Gas sponsorship requires ERC-4337 UserOperations.');
        console.log('  CLI uses direct EOA transactions (not sponsored).');
        console.log('  Frontend passkey accounts use the bundler + paymaster flow.');
        console.log('');
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
