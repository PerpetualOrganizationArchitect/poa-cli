import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import { createSigner } from '../../lib/signer';
import { createWriteContract } from '../../lib/contracts';
import { executeTx } from '../../lib/tx';
import { pinJson } from '../../lib/ipfs';
import { stringToBytes, ipfsCidToBytes32, parseProjectId } from '../../lib/encoding';
import { requireArg } from '../../lib/validation';
import { getTokenDecimals } from '../../config/tokens';
import * as output from '../../lib/output';
import { resolveOrgContracts } from './helpers';

interface CreateArgs {
  org: string;
  project: string;
  name: string;
  description: string;
  payout: number;
  difficulty?: string;
  'est-hours'?: number;
  location?: string;
  'bounty-token'?: string;
  'bounty-amount'?: number;
  'requires-application'?: boolean;
  chain?: number;
  rpc?: string;
  'private-key'?: string;
  'dry-run'?: boolean;
}

export const createHandler = {
  builder: (yargs: Argv) => yargs
    .option('project', { type: 'string', demandOption: true, describe: 'Project ID' })
    .option('name', { type: 'string', demandOption: true, describe: 'Task name' })
    .option('description', { type: 'string', demandOption: true, describe: 'Task description' })
    .option('payout', { type: 'number', demandOption: true, describe: 'PT payout amount' })
    .option('difficulty', { type: 'string', default: 'medium', describe: 'Difficulty (easy/medium/hard)' })
    .option('est-hours', { type: 'number', default: 0, describe: 'Estimated hours' })
    .option('location', { type: 'string', default: '', describe: 'Location' })
    .option('bounty-token', { type: 'string', describe: 'Bounty ERC20 token address' })
    .option('bounty-amount', { type: 'number', describe: 'Bounty payout amount' })
    .option('requires-application', { type: 'boolean', default: false, describe: 'Require applications' }),

  handler: async (argv: ArgumentsCamelCase<CreateArgs>) => {
    const spin = output.spinner('Creating task...');
    spin.start();

    try {
      const { taskManagerAddress } = await resolveOrgContracts(argv.org, argv.chain);
      const { signer } = createSigner({ privateKey: argv.privateKey as string, chainId: argv.chain, rpcUrl: argv.rpc as string });

      // Build metadata JSON (key order must match frontend exactly)
      const metadata = {
        name: argv.name,
        description: argv.description,
        location: argv.location || '',
        difficulty: argv.difficulty || 'medium',
        estHours: argv.estHours || 0,
        submission: '',
      };

      spin.text = 'Pinning metadata to IPFS...';
      const cid = await pinJson(JSON.stringify(metadata));
      const metadataHash = ipfsCidToBytes32(cid);

      const titleBytes = stringToBytes(argv.name);
      const pid = parseProjectId(argv.project);
      const payoutWei = ethers.utils.parseUnits(argv.payout.toString(), 18);

      const bountyToken = argv.bountyToken || ethers.constants.AddressZero;
      let bountyPayoutWei: ethers.BigNumber | number = 0;
      if (argv.bountyAmount && argv.bountyAmount > 0 && bountyToken !== ethers.constants.AddressZero) {
        const decimals = getTokenDecimals(bountyToken);
        bountyPayoutWei = ethers.utils.parseUnits(argv.bountyAmount.toString(), decimals);
      }

      const requiresApp = argv.requiresApplication || false;

      spin.text = 'Sending transaction...';
      const contract = createWriteContract(taskManagerAddress, 'TaskManagerNew', signer);
      const result = await executeTx(
        contract,
        'createTask',
        [payoutWei, titleBytes, metadataHash, pid, bountyToken, bountyPayoutWei, requiresApp],
        { dryRun: argv.dryRun }
      );

      spin.stop();

      if (result.success) {
        // Extract taskId from TaskCreated event
        const taskCreatedEvent = result.logs?.find(l => l.name === 'TaskCreated');
        const taskId = taskCreatedEvent?.args?.id?.toString();

        output.success('Task created', {
          taskId,
          txHash: result.txHash,
          explorerUrl: result.explorerUrl,
          ipfsCid: cid,
        });
        output.subgraphLagWarning();
      } else {
        output.error('Task creation failed', { error: result.error, errorCode: result.errorCode });
        process.exit(2);
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
