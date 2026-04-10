import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import * as fs from 'fs';
import { createSigner } from '../../lib/signer';
import { createWriteContract } from '../../lib/contracts';
import { executeTx } from '../../lib/tx';
import { pinJson } from '../../lib/ipfs';
import { stringToBytes, ipfsCidToBytes32 } from '../../lib/encoding';
import { resolveOrgModules } from '../../lib/resolve';
import { resolveVotingContracts } from '../vote/helpers';
import * as output from '../../lib/output';

interface ProposeDistributionArgs {
  org: string;
  'merkle-file': string;
  duration: number;
  chain?: number;
  rpc?: string;
  'private-key'?: string;
  'dry-run'?: boolean;
}

const PM_ABI = [
  'function createDistribution(address payoutToken, uint256 amount, bytes32 merkleRoot, uint256 checkpointBlock) returns (uint256)',
];

export const proposeDistributionHandler = {
  builder: (yargs: Argv) => yargs
    .option('merkle-file', { type: 'string', demandOption: true, describe: 'Path to merkle-distribution.json from compute-merkle' })
    .option('duration', { type: 'number', default: 1440, describe: 'Vote duration in minutes' }),

  handler: async (argv: ArgumentsCamelCase<ProposeDistributionArgs>) => {
    const spin = output.spinner('Creating distribution proposal...');
    spin.start();

    try {
      // Read merkle file from compute-merkle output
      const merkleFilePath = argv.merkleFile as string;
      if (!fs.existsSync(merkleFilePath)) {
        throw new Error(`Merkle file not found: ${merkleFilePath}. Run 'pop treasury compute-merkle' first.`);
      }

      const merkleData = JSON.parse(fs.readFileSync(merkleFilePath, 'utf8'));
      const { merkleRoot, totalAmount, tokenAddress, checkpointBlock, memberCount, allocations } = merkleData;

      if (!merkleRoot || !totalAmount || !tokenAddress || !checkpointBlock) {
        throw new Error('Invalid merkle file — missing required fields (merkleRoot, totalAmount, tokenAddress, checkpointBlock)');
      }

      const modules = await resolveOrgModules(argv.org, argv.chain);
      const votingContracts = await resolveVotingContracts(argv.org, argv.chain);
      const { signer } = createSigner({ privateKey: argv.privateKey as string, chainId: argv.chain, rpcUrl: argv.rpc as string });

      const paymentManagerAddr = modules.paymentManagerAddress;
      if (!paymentManagerAddr) throw new Error('No PaymentManager found');
      const hybridVotingAddr = votingContracts.hybridVotingAddress;
      if (!hybridVotingAddr) throw new Error('No HybridVoting found');

      // Encode createDistribution execution call
      const pmIface = new ethers.utils.Interface(PM_ABI);
      const createDistData = pmIface.encodeFunctionData('createDistribution', [
        tokenAddress,
        ethers.BigNumber.from(totalAmount),
        merkleRoot,
        checkpointBlock,
      ]);

      const calls = [
        [paymentManagerAddr, ethers.BigNumber.from(0), createDistData],
      ];

      // Build allocation summary for proposal description
      const allocationSummary = allocations
        .map((a: any) => `${a.username || a.address.slice(0, 10) + '...'} (${a.share})`)
        .join(', ');

      const totalHuman = ethers.utils.formatEther(totalAmount);

      const proposalMeta = {
        description: `Create distribution of ${totalHuman} tokens to ${memberCount} members proportional to PT holdings. Allocations: ${allocationSummary}. Merkle root: ${merkleRoot}. Checkpoint block: ${checkpointBlock}.`,
        optionNames: [`Distribute ${totalHuman} tokens`, 'Do not distribute'],
        createdAt: Date.now(),
      };

      spin.text = 'Pinning proposal metadata...';
      const cid = await pinJson(JSON.stringify(proposalMeta));
      const descriptionHash = ipfsCidToBytes32(cid);
      const title = stringToBytes(`Distribute ${totalHuman} tokens to ${memberCount} members`);

      const batches = [calls, []]; // option 0 = distribute, option 1 = no-op

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
        output.success('Distribution proposal created', {
          proposalId: proposalEvent?.args?.id?.toString(),
          txHash: result.txHash,
          explorerUrl: result.explorerUrl,
          totalAmount: totalHuman,
          tokenAddress,
          merkleRoot,
          checkpointBlock,
          memberCount,
        });
        output.subgraphLagWarning();
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
