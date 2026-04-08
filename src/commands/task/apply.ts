import type { Argv, ArgumentsCamelCase } from 'yargs';
import { createSigner } from '../../lib/signer';
import { createWriteContract } from '../../lib/contracts';
import { executeTx } from '../../lib/tx';
import { pinJson } from '../../lib/ipfs';
import { parseTaskId, ipfsCidToBytes32 } from '../../lib/encoding';
import * as output from '../../lib/output';
import { resolveOrgContracts } from './helpers';

interface ApplyArgs {
  org: string;
  task: string;
  notes?: string;
  experience?: string;
  chain?: number;
  rpc?: string;
  'private-key'?: string;
  'dry-run'?: boolean;
}

export const applyHandler = {
  builder: (yargs: Argv) => yargs
    .option('task', { type: 'string', demandOption: true, describe: 'Task ID' })
    .option('notes', { type: 'string', describe: 'Application notes' })
    .option('experience', { type: 'string', describe: 'Relevant experience' }),

  handler: async (argv: ArgumentsCamelCase<ApplyArgs>) => {
    const spin = output.spinner('Applying for task...');
    spin.start();

    try {
      const { taskManagerAddress } = await resolveOrgContracts(argv.org, argv.chain);
      const { signer } = createSigner({ privateKey: argv.privateKey as string, chainId: argv.chain, rpcUrl: argv.rpc as string });

      // Upload application data to IPFS
      const applicationData = {
        notes: argv.notes || '',
        experience: argv.experience || '',
      };

      spin.text = 'Pinning application to IPFS...';
      const cid = await pinJson(JSON.stringify(applicationData));
      const applicationHash = ipfsCidToBytes32(cid);

      spin.text = 'Sending transaction...';
      const contract = createWriteContract(taskManagerAddress, 'TaskManagerNew', signer);
      const parsedTaskId = parseTaskId(argv.task);

      const result = await executeTx(contract, 'applyForTask', [parsedTaskId, applicationHash], { dryRun: argv.dryRun });
      spin.stop();

      if (result.success) {
        output.success(`Applied for task ${argv.task}`, { txHash: result.txHash, explorerUrl: result.explorerUrl, ipfsCid: cid });
      } else {
        output.error('Application failed', { error: result.error, errorCode: result.errorCode });
        process.exit(2);
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
