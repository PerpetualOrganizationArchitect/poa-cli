import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import { createSigner } from '../../lib/signer';
import { createWriteContract } from '../../lib/contracts';
import { executeTx } from '../../lib/tx';
import { pinJson } from '../../lib/ipfs';
import { stringToBytes, ipfsCidToBytes32 } from '../../lib/encoding';
import * as output from '../../lib/output';
import { resolveOrgContracts } from '../task/helpers';

interface CreateArgs {
  org: string;
  name: string;
  cap: number;
  description?: string;
  managers?: string;
  'create-hats'?: string;
  'claim-hats'?: string;
  'review-hats'?: string;
  'assign-hats'?: string;
  'bounty-tokens'?: string;
  'bounty-caps'?: string;
  chain?: number;
  rpc?: string;
  'private-key'?: string;
  'dry-run'?: boolean;
}

function parseCommaList(val?: string): string[] {
  if (!val) return [];
  return val.split(',').map(s => s.trim()).filter(Boolean);
}

function parseNumberList(val?: string): number[] {
  if (!val) return [];
  return val.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
}

function parseBigNumberList(val?: string): ethers.BigNumber[] {
  if (!val) return [];
  return val.split(',').map(s => ethers.BigNumber.from(s.trim()));
}

export const createHandler = {
  builder: (yargs: Argv) => yargs
    .option('name', { type: 'string', demandOption: true, describe: 'Project name' })
    .option('cap', { type: 'number', default: 0, describe: 'PT cap (0 = unlimited)' })
    .option('description', { type: 'string', describe: 'Project description' })
    .option('managers', { type: 'string', describe: 'Comma-separated manager addresses' })
    .option('create-hats', { type: 'string', describe: 'Comma-separated hat IDs for create permission' })
    .option('claim-hats', { type: 'string', describe: 'Comma-separated hat IDs for claim permission' })
    .option('review-hats', { type: 'string', describe: 'Comma-separated hat IDs for review permission' })
    .option('assign-hats', { type: 'string', describe: 'Comma-separated hat IDs for assign permission' })
    .option('bounty-tokens', { type: 'string', describe: 'Comma-separated bounty token addresses' })
    .option('bounty-caps', { type: 'string', describe: 'Comma-separated bounty caps (wei)' }),

  handler: async (argv: ArgumentsCamelCase<CreateArgs>) => {
    const spin = output.spinner('Creating project...');
    spin.start();

    try {
      const { taskManagerAddress } = await resolveOrgContracts(argv.org, argv.chain);
      const { signer } = createSigner({ privateKey: argv.privateKey as string, chainId: argv.chain, rpcUrl: argv.rpc as string });

      // Upload metadata if description provided
      let metaHash = ethers.constants.HashZero;
      if (argv.description) {
        const metadata = { description: argv.description };
        spin.text = 'Pinning metadata to IPFS...';
        const cid = await pinJson(JSON.stringify(metadata));
        metaHash = ipfsCidToBytes32(cid);
      }

      const titleBytes = stringToBytes(argv.name);
      const cap = argv.cap ? ethers.utils.parseUnits(argv.cap.toString(), 18) : 0;

      // Build BootstrapProjectConfig struct
      const projectStruct = [
        titleBytes,
        metaHash,
        cap,
        parseCommaList(argv.managers as string),
        parseNumberList(argv.createHats as string),
        parseNumberList(argv.claimHats as string),
        parseNumberList(argv.reviewHats as string),
        parseNumberList(argv.assignHats as string),
        parseCommaList(argv.bountyTokens as string),  // address[]
        parseBigNumberList(argv.bountyCaps as string), // uint256[] (wei)
      ];

      spin.text = 'Sending transaction...';
      const contract = createWriteContract(taskManagerAddress, 'TaskManagerNew', signer);
      const result = await executeTx(contract, 'createProject', [projectStruct], { dryRun: argv.dryRun });
      spin.stop();

      if (result.success) {
        const projectEvent = result.logs?.find(l => l.name === 'ProjectCreated');
        const projectId = projectEvent?.args?.id?.toString();
        output.success('Project created', { projectId, txHash: result.txHash, explorerUrl: result.explorerUrl });
      } else {
        output.error('Project creation failed', { error: result.error, errorCode: result.errorCode });
        process.exit(2);
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
