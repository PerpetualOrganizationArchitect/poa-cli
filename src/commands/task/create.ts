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
import { query } from '../../lib/subgraph';
import { FETCH_PROJECTS_DATA } from '../../queries/task';

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
  force?: boolean;
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
    .option('requires-application', { type: 'boolean', default: false, describe: 'Require applications' })
    .option('force', { type: 'boolean', default: false, describe: 'Skip duplicate check' }),

  handler: async (argv: ArgumentsCamelCase<CreateArgs>) => {
    const spin = output.spinner('Creating task...');
    spin.start();

    try {
      const { taskManagerAddress, orgId } = await resolveOrgContracts(argv.org, argv.chain);
      const { signer } = createSigner({ privateKey: argv.privateKey as string, chainId: argv.chain, rpcUrl: argv.rpc as string });

      // Duplicate check: warn if similar task exists
      if (!argv.force) {
        try {
          const result = await query<any>(FETCH_PROJECTS_DATA, { orgId }, argv.chain);
          const projects = result.organization?.taskManager?.projects || [];
          const allTasks = projects.flatMap((p: any) => p.tasks || []);
          const newWords = new Set((argv.name as string).toLowerCase().split(/\s+/).filter(w => w.length > 3));
          if (newWords.size > 0) {
            for (const task of allTasks) {
              if (task.status === 'Cancelled') continue;
              const existingWords = new Set((task.title || '').toLowerCase().split(/\s+/).filter((w: string) => w.length > 3));
              const overlap = [...newWords].filter(w => existingWords.has(w)).length;
              const similarity = overlap / Math.max(newWords.size, 1);
              if (similarity >= 0.5) {
                spin.stop();
                output.warn(`Similar task exists: #${task.taskId} "${task.title}" (${task.status}). Use --force to create anyway.`);
                process.exit(1);
              }
            }
          }
        } catch {
          // If duplicate check fails, proceed anyway
        }
      }

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

      // Resolve project name to on-chain bytes32 ID
      let pid: string;
      const projectInput = argv.project as string;
      if (projectInput.startsWith('0x') && projectInput.length === 66) {
        pid = projectInput;
      } else {
        // Try to match by name via subgraph
        const projResult = await query<any>(FETCH_PROJECTS_DATA, { orgId }, argv.chain);
        const projects = projResult.organization?.taskManager?.projects || [];
        const match = projects.find((p: any) =>
          (p.title || '').toLowerCase() === projectInput.toLowerCase()
        );
        if (match) {
          // Extract bytes32 project ID from subgraph composite ID: "{contractAddress}-{projectIdHex}"
          pid = parseProjectId(match.id);
        } else {
          // Try parsing as a numeric index
          const num = parseInt(projectInput, 10);
          if (!isNaN(num)) {
            pid = ethers.utils.hexZeroPad(ethers.utils.hexlify(num), 32);
          } else {
            const available = projects.map((p: any) => p.title).filter(Boolean).join(', ');
            throw new Error(`Project "${projectInput}" not found. Available: ${available || 'none'}`);
          }
        }
      }

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
