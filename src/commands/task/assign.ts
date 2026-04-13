import type { Argv, ArgumentsCamelCase } from 'yargs';
import { createSigner } from '../../lib/signer';
import { createWriteContract } from '../../lib/contracts';
import { executeTx } from '../../lib/tx';
import { parseTaskId } from '../../lib/encoding';
import { requireAddress } from '../../lib/validation';
import * as output from '../../lib/output';
import { resolveOrgContracts } from './helpers';

interface AssignArgs {
  org: string;
  task: string;
  assignee?: string;
  username?: string;
  chain?: number;
  rpc?: string;
  'private-key'?: string;
  'dry-run'?: boolean;
}

async function resolveUsernameToAddress(username: string, chainId?: number): Promise<string> {
  const { queryAllChains } = require('../../lib/subgraph');
  const query = `{ accounts(where: { username: "${username}" }, first: 1) { id username } }`;
  const results = await queryAllChains(query, {});
  for (const r of results) {
    const account = r.data?.accounts?.[0];
    if (account) return account.id;
  }
  throw new Error(`Username "${username}" not found. Check spelling or use --assignee with the address.`);
}

export const assignHandler = {
  builder: (yargs: Argv) => yargs
    .option('task', { type: 'string', demandOption: true, describe: 'Task ID' })
    .option('assignee', { type: 'string', describe: 'Address to assign to' })
    .option('username', { type: 'string', describe: 'Username to assign to (resolves to address)' })
    .check((argv) => {
      if (!argv.assignee && !argv.username) throw new Error('Either --assignee or --username is required');
      return true;
    }),

  handler: async (argv: ArgumentsCamelCase<AssignArgs>) => {
    let assignee: string;
    if (argv.username) {
      assignee = await resolveUsernameToAddress(argv.username as string, argv.chain);
      console.log(`  Resolved "${argv.username}" → ${assignee.slice(0, 12)}...`);
    } else {
      assignee = requireAddress(argv.assignee, 'assignee');
    }
    const spin = output.spinner('Assigning task...');
    spin.start();

    try {
      const { taskManagerAddress } = await resolveOrgContracts(argv.org, argv.chain);
      const { signer } = createSigner({ privateKey: argv.privateKey as string, chainId: argv.chain, rpcUrl: argv.rpc as string });

      const contract = createWriteContract(taskManagerAddress, 'TaskManagerNew', signer);
      const parsedTaskId = parseTaskId(argv.task);

      const result = await executeTx(contract, 'assignTask', [parsedTaskId, assignee], { dryRun: argv.dryRun });
      spin.stop();

      if (result.success) {
        output.success(`Task ${argv.task} assigned to ${assignee}`, { txHash: result.txHash, explorerUrl: result.explorerUrl });
      } else {
        output.error('Assignment failed', { error: result.error, errorCode: result.errorCode });
        process.exit(2);
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
