import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import { createSigner } from '../../lib/signer';
import { createWriteContract } from '../../lib/contracts';
import { executeTx } from '../../lib/tx';
import { pinJson } from '../../lib/ipfs';
import { stringToBytes, ipfsCidToBytes32 } from '../../lib/encoding';
import { resolveOrgModules } from '../../lib/resolve';
import { resolveVotingContracts } from '../vote/helpers';
import { resolveNetworkConfig } from '../../config/networks';
import * as output from '../../lib/output';

interface ProposeSwapArgs {
  org: string;
  'from-token': string;
  'to-token': string;
  amount: number;
  'min-out'?: number;
  'pool': string;
  'from-index': number;
  'to-index': number;
  duration: number;
  chain?: number;
  rpc?: string;
  'private-key'?: string;
  'dry-run'?: boolean;
}

const ERC20_ABI = ['function approve(address spender, uint256 amount) returns (bool)'];
const CURVE_ABI = ['function exchange(int128 i, int128 j, uint256 dx, uint256 min_dy) returns (uint256)'];

export const proposeSwapHandler = {
  builder: (yargs: Argv) => yargs
    .option('from-token', { type: 'string', demandOption: true, describe: 'Token to sell (address)' })
    .option('to-token', { type: 'string', demandOption: true, describe: 'Token to receive (address)' })
    .option('amount', { type: 'number', demandOption: true, describe: 'Amount to swap (human-readable)' })
    .option('min-out', { type: 'number', describe: 'Minimum output amount (default: 95% of input for stables)' })
    .option('pool', { type: 'string', demandOption: true, describe: 'Curve pool address' })
    .option('from-index', { type: 'number', demandOption: true, describe: 'Curve coin index for from-token (0 or 1)' })
    .option('to-index', { type: 'number', demandOption: true, describe: 'Curve coin index for to-token (0 or 1)' })
    .option('duration', { type: 'number', default: 1440, describe: 'Vote duration in minutes' }),

  handler: async (argv: ArgumentsCamelCase<ProposeSwapArgs>) => {
    const spin = output.spinner('Creating swap proposal...');
    spin.start();

    try {
      const modules = await resolveOrgModules(argv.org, argv.chain);
      const votingContracts = await resolveVotingContracts(argv.org, argv.chain);
      const { signer } = createSigner({ privateKey: argv.privateKey as string, chainId: argv.chain, rpcUrl: argv.rpc as string });

      const executorAddr = modules.executorAddress;
      if (!executorAddr) throw new Error('No executor contract found');
      const hybridVotingAddr = votingContracts.hybridVotingAddress;
      if (!hybridVotingAddr) throw new Error('No HybridVoting found');

      const poolAddr = argv.pool as string;
      const fromToken = argv.fromToken as string;
      const amountWei = ethers.utils.parseUnits(argv.amount.toString(), 18);
      const minOut = argv.minOut
        ? ethers.utils.parseUnits(argv.minOut.toString(), 18)
        : amountWei.mul(95).div(100); // 5% slippage default for stables

      // Get a quote from the pool
      spin.text = 'Getting swap quote...';
      const networkConfig = resolveNetworkConfig(argv.chain);
      const provider = new ethers.providers.JsonRpcProvider(networkConfig.resolvedRpc);
      const poolContract = new ethers.Contract(poolAddr, [
        'function get_dy(int128 i, int128 j, uint256 dx) view returns (uint256)',
      ], provider);

      let expectedOut: ethers.BigNumber;
      try {
        expectedOut = await poolContract.get_dy(argv.fromIndex, argv.toIndex, amountWei);
      } catch {
        expectedOut = amountWei; // fallback
      }

      // Encode execution calls:
      // 1. Withdraw from PaymentManager to Executor
      const pmAddr = modules.paymentManagerAddress;
      const withdrawIface = new ethers.utils.Interface([
        'function withdraw(address token, address to, uint256 amount)',
      ]);
      const withdrawData = withdrawIface.encodeFunctionData('withdraw', [
        fromToken, executorAddr, amountWei,
      ]);

      // 2. Approve pool to spend from-token
      const erc20Iface = new ethers.utils.Interface(ERC20_ABI);
      const approveData = erc20Iface.encodeFunctionData('approve', [poolAddr, amountWei]);

      // 3. Call pool.exchange()
      const curveIface = new ethers.utils.Interface(CURVE_ABI);
      const exchangeData = curveIface.encodeFunctionData('exchange', [
        argv.fromIndex, argv.toIndex, amountWei, minOut,
      ]);

      const calls = [
        [pmAddr, ethers.BigNumber.from(0), withdrawData],    // withdraw from treasury
        [fromToken, ethers.BigNumber.from(0), approveData],  // approve DEX
        [poolAddr, ethers.BigNumber.from(0), exchangeData],  // swap
      ];

      // Build proposal metadata
      const proposalMeta = {
        description: `Swap ${argv.amount} tokens via Curve pool ${poolAddr}. Withdraws from PaymentManager, approves pool, executes swap. Expected output: ~${ethers.utils.formatEther(expectedOut)}. Min output: ${ethers.utils.formatEther(minOut)}.`,
        optionNames: [`Execute swap (${argv.amount} tokens)`, 'Do not swap'],
        createdAt: Date.now(),
      };

      spin.text = 'Pinning proposal metadata...';
      const cid = await pinJson(JSON.stringify(proposalMeta));
      const descriptionHash = ipfsCidToBytes32(cid);
      const title = stringToBytes(`Treasury swap: ${argv.amount} tokens via Curve`);

      const batches = [calls, []]; // option 0 = swap, option 1 = no-op

      spin.text = 'Creating proposal...';
      const contract = createWriteContract(hybridVotingAddr, 'HybridVotingNew', signer);
      const result = await executeTx(
        contract,
        'createProposal',
        [title, descriptionHash, argv.duration, 2, batches, []],
        { dryRun: argv.dryRun }
      );

      spin.stop();

      if (result.success) {
        const proposalEvent = result.logs?.find(l => l.name === 'NewProposal');
        output.success('Swap proposal created', {
          proposalId: proposalEvent?.args?.id?.toString(),
          txHash: result.txHash,
          explorerUrl: result.explorerUrl,
          amount: argv.amount.toString(),
          expectedOutput: ethers.utils.formatEther(expectedOut),
          minOutput: ethers.utils.formatEther(minOut),
          pool: poolAddr,
        });
      } else {
        output.error('Proposal creation failed', { error: result.error, errorCode: result.errorCode });
        process.exit(2);
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
