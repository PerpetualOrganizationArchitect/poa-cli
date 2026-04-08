import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import { createSigner } from '../../lib/signer';
import { createWriteContract } from '../../lib/contracts';
import { executeTx } from '../../lib/tx';
import { pinJson } from '../../lib/ipfs';
import { stringToBytes, ipfsCidToBytes32 } from '../../lib/encoding';
import * as output from '../../lib/output';
import { resolveVotingContracts } from './helpers';

interface CreateArgs {
  org: string;
  type: string;
  name: string;
  description: string;
  duration: number;
  options: string;
  'hat-ids'?: string;
  chain?: number;
  rpc?: string;
  'private-key'?: string;
  'dry-run'?: boolean;
}

export const createHandler = {
  builder: (yargs: Argv) => yargs
    .option('type', { type: 'string', demandOption: true, choices: ['hybrid', 'dd'], describe: 'Voting type' })
    .option('name', { type: 'string', demandOption: true, describe: 'Proposal title' })
    .option('description', { type: 'string', demandOption: true, describe: 'Proposal description' })
    .option('duration', { type: 'number', demandOption: true, describe: 'Duration in minutes' })
    .option('options', { type: 'string', demandOption: true, describe: 'Comma-separated option names' })
    .option('hat-ids', { type: 'string', describe: 'Comma-separated hat IDs for restricted voting' }),

  handler: async (argv: ArgumentsCamelCase<CreateArgs>) => {
    const spin = output.spinner('Creating proposal...');
    spin.start();

    try {
      const contracts = await resolveVotingContracts(argv.org, argv.chain);
      const { signer } = createSigner({ privateKey: argv.privateKey as string, chainId: argv.chain, rpcUrl: argv.rpc as string });

      const isHybrid = argv.type === 'hybrid';
      const contractAddr = isHybrid ? contracts.hybridVotingAddress : contracts.ddVotingAddress;
      if (!contractAddr) {
        throw new Error(`${isHybrid ? 'HybridVoting' : 'DirectDemocracyVoting'} not deployed for this org`);
      }

      const optionNames = (argv.options as string).split(',').map(s => s.trim());
      const numOptions = optionNames.length;

      if (numOptions < 2) {
        throw new Error('At least 2 options are required');
      }

      // Upload proposal metadata to IPFS
      const proposalMetadata = {
        description: argv.description,
        optionNames,
        createdAt: Date.now(),
      };

      spin.text = 'Pinning proposal metadata to IPFS...';
      const cid = await pinJson(JSON.stringify(proposalMetadata));
      const descriptionHash = ipfsCidToBytes32(cid);

      const titleBytes = stringToBytes(argv.name);
      const batches: any[][] = []; // No execution batches by default
      const hatIds = argv.hatIds
        ? (argv.hatIds as string).split(',').map(s => parseInt(s.trim(), 10))
        : [];

      spin.text = 'Sending transaction...';
      const abiName = isHybrid ? 'HybridVotingNew' : 'DirectDemocracyVotingNew';
      const contract = createWriteContract(contractAddr, abiName, signer);

      const result = await executeTx(
        contract,
        'createProposal',
        [titleBytes, descriptionHash, argv.duration, numOptions, batches, hatIds],
        { dryRun: argv.dryRun }
      );

      spin.stop();

      if (result.success) {
        const proposalEvent = result.logs?.find(l => l.name === 'NewProposal' || l.name === 'NewHatProposal');
        const proposalId = proposalEvent?.args?.id?.toString();
        output.success('Proposal created', {
          proposalId,
          txHash: result.txHash,
          explorerUrl: result.explorerUrl,
          type: argv.type,
          options: optionNames.join(', '),
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
