import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import fs from 'fs';
import { createSigner } from '../../lib/signer';
import { createWriteContract } from '../../lib/contracts';
import { executeTx } from '../../lib/tx';
import { pinJson } from '../../lib/ipfs';
import { stringToBytes, ipfsCidToBytes32, parseProjectId } from '../../lib/encoding';
import { getTokenDecimals } from '../../config/tokens';
import * as output from '../../lib/output';
import { resolveOrgContracts } from './helpers';

interface BatchArgs {
  org?: string;
  project: string;
  file: string;
  'continue-on-error'?: boolean;
  chain?: number;
  rpc?: string;
  'private-key'?: string;
  'dry-run'?: boolean;
}

interface TaskLine {
  name: string;
  description: string;
  payout: number;
  difficulty?: string;
  estHours?: number;
  location?: string;
  bountyToken?: string;
  bountyAmount?: number;
  requiresApplication?: boolean;
}

export const createBatchHandler = {
  builder: (yargs: Argv) => yargs
    .option('project', { type: 'string', demandOption: true, describe: 'Project ID (shared for all tasks)' })
    .option('file', { type: 'string', demandOption: true, describe: 'JSONL file (one task JSON per line)' })
    .option('continue-on-error', { type: 'boolean', default: false, describe: 'Skip failed tasks instead of stopping' }),

  handler: async (argv: ArgumentsCamelCase<BatchArgs>) => {
    // Validate file
    if (!fs.existsSync(argv.file)) {
      output.error(`File not found: ${argv.file}`);
      process.exit(1);
      return;
    }

    const lines = fs.readFileSync(argv.file, 'utf-8').trim().split('\n').filter(Boolean);
    if (lines.length === 0) {
      output.error('File is empty');
      process.exit(1);
      return;
    }

    // Parse all lines upfront to catch errors before sending any transactions
    const tasks: TaskLine[] = [];
    for (let i = 0; i < lines.length; i++) {
      try {
        const task = JSON.parse(lines[i]) as TaskLine;
        if (!task.name || !task.description || task.payout === undefined) {
          throw new Error('Missing required fields: name, description, payout');
        }
        tasks.push(task);
      } catch (err: any) {
        output.error(`Line ${i + 1}: ${err.message}`);
        if (!argv.continueOnError) process.exit(1);
      }
    }

    output.info(`Creating ${tasks.length} tasks...`);

    try {
      const { taskManagerAddress } = await resolveOrgContracts(argv.org as string, argv.chain);
      const { signer } = createSigner({ privateKey: argv.privateKey as string, chainId: argv.chain, rpcUrl: argv.rpc as string });
      const contract = createWriteContract(taskManagerAddress, 'TaskManagerNew', signer);
      const pid = parseProjectId(argv.project);

      const results: Array<{ name: string; taskId?: string; txHash?: string; status: string; error?: string }> = [];

      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const spin = output.spinner(`[${i + 1}/${tasks.length}] Creating "${task.name}"...`);
        spin.start();

        try {
          // Build metadata (key order matches frontend)
          const metadata = {
            name: task.name,
            description: task.description,
            location: task.location || '',
            difficulty: task.difficulty || 'medium',
            estHours: task.estHours || 0,
            submission: '',
          };

          const cid = await pinJson(JSON.stringify(metadata));
          const metadataHash = ipfsCidToBytes32(cid);
          const titleBytes = stringToBytes(task.name);
          const payoutWei = ethers.utils.parseUnits(task.payout.toString(), 18);

          const bountyToken = task.bountyToken || ethers.constants.AddressZero;
          let bountyPayoutWei: ethers.BigNumber | number = 0;
          if (task.bountyAmount && task.bountyAmount > 0 && bountyToken !== ethers.constants.AddressZero) {
            const decimals = getTokenDecimals(bountyToken);
            bountyPayoutWei = ethers.utils.parseUnits(task.bountyAmount.toString(), decimals);
          }

          const result = await executeTx(
            contract,
            'createTask',
            [payoutWei, titleBytes, metadataHash, pid, bountyToken, bountyPayoutWei, task.requiresApplication || false],
            { dryRun: argv.dryRun }
          );

          spin.stop();

          if (result.success) {
            const taskCreatedEvent = result.logs?.find(l => l.name === 'TaskCreated');
            const taskId = taskCreatedEvent?.args?.id?.toString();
            results.push({ name: task.name, taskId, txHash: result.txHash, status: 'ok' });
            output.success(`[${i + 1}/${tasks.length}] "${task.name}" created`, { taskId });
          } else {
            results.push({ name: task.name, status: 'failed', error: result.error });
            output.error(`[${i + 1}/${tasks.length}] "${task.name}" failed: ${result.error}`);
            if (!argv.continueOnError) break;
          }
        } catch (err: any) {
          spin.stop();
          results.push({ name: task.name, status: 'failed', error: err.message });
          output.error(`[${i + 1}/${tasks.length}] "${task.name}" failed: ${err.message}`);
          if (!argv.continueOnError) break;
        }
      }

      // Summary
      const succeeded = results.filter(r => r.status === 'ok').length;
      const failed = results.filter(r => r.status === 'failed').length;

      if (output.isJsonMode()) {
        output.json({ results, total: tasks.length, succeeded, failed });
      } else {
        console.log('');
        output.info(`Batch complete: ${succeeded} succeeded, ${failed} failed out of ${tasks.length}`);
      }

      if (failed > 0) process.exit(2);
    } catch (err: any) {
      output.error(err.message);
      process.exit(1);
    }
  },
};
