import type { Argv, ArgumentsCamelCase } from 'yargs';
import { createSigner } from '../../lib/signer';
import { createWriteContract } from '../../lib/contracts';
import { executeTx } from '../../lib/tx';
import { parseModuleId } from '../../lib/encoding';
import * as output from '../../lib/output';
import { resolveEducationContracts } from './helpers';

interface CompleteArgs {
  org: string;
  module: string;
  answer: number;
  chain?: number;
  rpc?: string;
  'private-key'?: string;
  'dry-run'?: boolean;
}

export const completeHandler = {
  builder: (yargs: Argv) => yargs
    .option('module', { type: 'string', demandOption: true, describe: 'Module ID' })
    .option('answer', { type: 'number', demandOption: true, describe: 'Answer index (0-based)' }),

  handler: async (argv: ArgumentsCamelCase<CompleteArgs>) => {
    const spin = output.spinner('Completing module...');
    spin.start();

    try {
      const { educationHubAddress } = await resolveEducationContracts(argv.org, argv.chain);
      const { signer } = createSigner({ privateKey: argv.privateKey as string, chainId: argv.chain, rpcUrl: argv.rpc as string });

      const contract = createWriteContract(educationHubAddress, 'EducationHubNew', signer);
      const moduleId = parseModuleId(argv.module);

      const result = await executeTx(
        contract,
        'completeModule',
        [moduleId, argv.answer],
        { dryRun: argv.dryRun }
      );

      spin.stop();

      if (result.success) {
        output.success(`Module ${argv.module} completed`, { txHash: result.txHash, explorerUrl: result.explorerUrl });
      } else {
        output.error('Module completion failed', { error: result.error, errorCode: result.errorCode });
        process.exit(2);
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
