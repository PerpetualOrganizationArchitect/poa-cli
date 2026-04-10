import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import { createSigner } from '../../lib/signer';
import { createWriteContract } from '../../lib/contracts';
import { executeTx } from '../../lib/tx';
import { pinJson } from '../../lib/ipfs';
import { stringToBytes, ipfsCidToBytes32 } from '../../lib/encoding';
import { resolveNetworkConfig } from '../../config/networks';
import { resolveOrgModules } from '../../lib/resolve';
import * as output from '../../lib/output';
import { resolveVotingContracts } from '../vote/helpers';

const WXDAI = '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d';
const SDAI = '0xaf204776c7245bF4147c2612BF6e5972Ee483701';

const WXDAI_ABI = new ethers.utils.Interface([
  'function deposit() payable',
  'function approve(address spender, uint256 amount) returns (bool)',
]);

const SDAI_ABI = new ethers.utils.Interface([
  'function deposit(uint256 assets, address receiver) returns (uint256 shares)',
  'function balanceOf(address) view returns (uint256)',
  'function convertToAssets(uint256 shares) view returns (uint256)',
]);

interface ProposeSdaiArgs {
  org: string;
  amount: number;
  duration: number;
  chain?: number;
  rpc?: string;
  'private-key'?: string;
  'dry-run'?: boolean;
}

export const proposeSdaiHandler = {
  builder: (yargs: Argv) => yargs
    .option('amount', { type: 'number', demandOption: true, describe: 'xDAI amount to deposit into sDAI' })
    .option('duration', { type: 'number', default: 60, describe: 'Vote duration in minutes' }),

  handler: async (argv: ArgumentsCamelCase<ProposeSdaiArgs>) => {
    const spin = output.spinner('Creating sDAI deposit proposal...');
    spin.start();

    try {
      const amount = argv.amount as number;
      if (amount <= 0) throw new Error('Amount must be positive');

      const modules = await resolveOrgModules(argv.org, argv.chain);
      const contracts = await resolveVotingContracts(argv.org, argv.chain);
      const { signer } = createSigner({ privateKey: argv.privateKey as string, chainId: argv.chain, rpcUrl: argv.rpc as string });
      const networkConfig = resolveNetworkConfig(argv.chain);
      const provider = new ethers.providers.JsonRpcProvider(networkConfig.resolvedRpc);

      if (!contracts.hybridVotingAddress) throw new Error('HybridVoting not deployed');
      const executorAddr = modules.executorAddress;
      if (!executorAddr) throw new Error('No executor address found');

      // Check executor xDAI balance
      const execBalance = await provider.getBalance(executorAddr);
      const amountWei = ethers.utils.parseEther(amount.toString());
      if (execBalance.lt(amountWei)) {
        throw new Error(`Executor has ${ethers.utils.formatEther(execBalance)} xDAI, need ${amount}`);
      }

      // Check current sDAI holdings
      const sdaiContract = new ethers.Contract(SDAI, SDAI_ABI.fragments, provider);
      const currentShares = await sdaiContract.balanceOf(executorAddr);
      const currentAssets = currentShares.gt(0) ? await sdaiContract.convertToAssets(currentShares) : ethers.BigNumber.from(0);

      // Encode execution calls: wrap → approve → deposit
      const wrapCall = WXDAI_ABI.encodeFunctionData('deposit', []);
      const approveCall = WXDAI_ABI.encodeFunctionData('approve', [SDAI, amountWei]);
      const depositCall = SDAI_ABI.encodeFunctionData('deposit', [amountWei, executorAddr]);

      const option0Batch = [
        [WXDAI, amountWei, wrapCall],
        [WXDAI, ethers.BigNumber.from(0), approveCall],
        [SDAI, ethers.BigNumber.from(0), depositCall],
      ];
      const batches = [option0Batch, []];

      // Pin metadata
      const metadata = {
        description: `Deposit ${amount} xDAI into sDAI (${SDAI}) for yield. Three execution steps: wrap xDAI to WXDAI, approve WXDAI, deposit into sDAI vault. Current sDAI holdings: ${ethers.utils.formatEther(currentShares)} shares (${ethers.utils.formatEther(currentAssets)} WXDAI equivalent). Executor retains ${ethers.utils.formatEther(execBalance.sub(amountWei))} xDAI liquid.`,
        optionNames: [`Deposit ${amount} xDAI into sDAI`, 'Keep xDAI liquid'],
        createdAt: Date.now(),
      };

      spin.text = 'Pinning metadata...';
      const cid = await pinJson(JSON.stringify(metadata));
      const descriptionHash = ipfsCidToBytes32(cid);
      const titleBytes = stringToBytes(`Deposit ${amount} xDAI into sDAI for yield`);

      spin.text = 'Sending transaction...';
      const contract = createWriteContract(contracts.hybridVotingAddress, 'HybridVotingNew', signer);
      const result = await executeTx(
        contract,
        'createProposal',
        [titleBytes, descriptionHash, argv.duration, 2, batches, []],
        { dryRun: argv.dryRun }
      );

      spin.stop();

      if (result.success) {
        const proposalEvent = result.logs?.find(l => l.name === 'NewProposal' || l.name === 'NewHatProposal');
        const proposalId = proposalEvent?.args?.id?.toString();
        output.success('sDAI deposit proposal created', {
          proposalId,
          txHash: result.txHash,
          explorerUrl: result.explorerUrl,
          amount: `${amount} xDAI`,
          currentSdai: `${ethers.utils.formatEther(currentShares)} shares`,
          currentValue: `${ethers.utils.formatEther(currentAssets)} WXDAI`,
          remainingLiquid: `${ethers.utils.formatEther(execBalance.sub(amountWei))} xDAI`,
          duration: `${argv.duration} minutes`,
          ipfsCid: cid,
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
