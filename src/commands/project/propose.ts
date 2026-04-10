import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import { createSigner } from '../../lib/signer';
import { createWriteContract } from '../../lib/contracts';
import { executeTx } from '../../lib/tx';
import { pinJson } from '../../lib/ipfs';
import { stringToBytes, ipfsCidToBytes32 } from '../../lib/encoding';
import { loadAbi } from '../../lib/contracts';
import { resolveOrgModules } from '../../lib/resolve';
import { resolveVotingContracts } from '../vote/helpers';
import * as output from '../../lib/output';

interface ProposeArgs {
  org: string;
  name: string;
  description?: string;
  cap: number;
  duration: number;
  'create-hats'?: string;
  'claim-hats'?: string;
  'review-hats'?: string;
  'assign-hats'?: string;
  chain?: number;
  rpc?: string;
  'private-key'?: string;
  'dry-run'?: boolean;
}

function parseBigNumberList(val?: string): ethers.BigNumber[] {
  if (!val) return [];
  return val.split(',').map(s => ethers.BigNumber.from(s.trim()));
}

export const proposeHandler = {
  builder: (yargs: Argv) => yargs
    .option('name', { type: 'string', demandOption: true, describe: 'Project name' })
    .option('description', { type: 'string', describe: 'Project description' })
    .option('cap', { type: 'number', default: 0, describe: 'PT budget cap (0 = unlimited)' })
    .option('duration', { type: 'number', default: 1440, describe: 'Vote duration in minutes (default 24h)' })
    .option('create-hats', { type: 'string', describe: 'Hat IDs for task creation permission' })
    .option('claim-hats', { type: 'string', describe: 'Hat IDs for task claim permission' })
    .option('review-hats', { type: 'string', describe: 'Hat IDs for task review permission' })
    .option('assign-hats', { type: 'string', describe: 'Hat IDs for task assign permission' }),

  handler: async (argv: ArgumentsCamelCase<ProposeArgs>) => {
    const spin = output.spinner('Creating project proposal...');
    spin.start();

    try {
      const modules = await resolveOrgModules(argv.org, argv.chain);
      const votingContracts = await resolveVotingContracts(argv.org, argv.chain);
      const { signer } = createSigner({ privateKey: argv.privateKey as string, chainId: argv.chain, rpcUrl: argv.rpc as string });

      const taskManagerAddr = modules.taskManagerAddress;
      if (!taskManagerAddr) {
        throw new Error('No TaskManager found for this org');
      }
      const hybridVotingAddr = votingContracts.hybridVotingAddress;
      if (!hybridVotingAddr) {
        throw new Error('No HybridVoting found for this org');
      }

      // Pin project metadata to IPFS
      let metaHash = ethers.constants.HashZero;
      if (argv.description) {
        const metadata = { description: argv.description };
        spin.text = 'Pinning project metadata to IPFS...';
        const cid = await pinJson(JSON.stringify(metadata));
        metaHash = ipfsCidToBytes32(cid);
      }

      // Build BootstrapProjectConfig struct
      const titleBytes = stringToBytes(argv.name);
      const cap = argv.cap ? ethers.utils.parseUnits(argv.cap.toString(), 18) : 0;
      const createHats = parseBigNumberList(argv.createHats as string);
      const claimHats = parseBigNumberList(argv.claimHats as string);
      const reviewHats = parseBigNumberList(argv.reviewHats as string);
      const assignHats = parseBigNumberList(argv.assignHats as string);

      const projectStruct = [
        titleBytes, metaHash, cap,
        [],          // managers (hat-based instead)
        createHats, claimHats, reviewHats, assignHats,
        [],          // bountyTokens
        [],          // bountyCaps
      ];

      // Encode the createProject call
      const taskManagerAbi = loadAbi('TaskManagerNew');
      const iface = new ethers.utils.Interface(taskManagerAbi);
      const calldata = iface.encodeFunctionData('createProject', [projectStruct]);

      // Build proposal metadata
      const proposalMeta = {
        description: `Create project "${argv.name}"${argv.description ? ': ' + argv.description : ''}. PT cap: ${argv.cap || 'unlimited'}. If this proposal passes, the project will be created automatically via execution call.`,
        optionNames: [`Create "${argv.name}"`, 'Do not create'],
        createdAt: Date.now(),
      };

      spin.text = 'Pinning proposal metadata to IPFS...';
      const proposalCid = await pinJson(JSON.stringify(proposalMeta));
      const descriptionHash = ipfsCidToBytes32(proposalCid);

      const proposalTitle = stringToBytes(`Create project: ${argv.name}`);

      // Build execution batches: option 0 = create project, option 1 = do nothing
      const batches = [
        [[taskManagerAddr, ethers.BigNumber.from(0), calldata]],
        [],
      ];

      spin.text = 'Creating proposal...';
      const contract = createWriteContract(hybridVotingAddr, 'HybridVotingNew', signer);
      const result = await executeTx(
        contract,
        'createProposal',
        [proposalTitle, descriptionHash, argv.duration, 2, batches, []],
        { dryRun: argv.dryRun }
      );

      spin.stop();

      if (result.success) {
        const proposalEvent = result.logs?.find(l => l.name === 'NewProposal');
        const proposalId = proposalEvent?.args?.id?.toString();
        output.success('Project proposal created', {
          proposalId,
          txHash: result.txHash,
          explorerUrl: result.explorerUrl,
          project: argv.name,
          cap: argv.cap ? `${argv.cap} PT` : 'unlimited',
          voteDuration: `${argv.duration} minutes`,
          ipfsCid: proposalCid,
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
