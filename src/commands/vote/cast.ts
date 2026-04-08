import type { Argv, ArgumentsCamelCase } from 'yargs';
import { createSigner } from '../../lib/signer';
import { createWriteContract } from '../../lib/contracts';
import { executeTx } from '../../lib/tx';
import * as output from '../../lib/output';
import { resolveVotingContracts } from './helpers';

interface CastArgs {
  org: string;
  type: string;
  proposal: number;
  options: string;
  weights: string;
  chain?: number;
  rpc?: string;
  'private-key'?: string;
  'dry-run'?: boolean;
}

export const castHandler = {
  builder: (yargs: Argv) => yargs
    .option('type', { type: 'string', demandOption: true, choices: ['hybrid', 'dd'], describe: 'Voting type' })
    .option('proposal', { type: 'number', demandOption: true, describe: 'Proposal ID' })
    .option('options', { type: 'string', demandOption: true, describe: 'Comma-separated option indices to vote for' })
    .option('weights', { type: 'string', demandOption: true, describe: 'Comma-separated weights (must sum to 100)' }),

  handler: async (argv: ArgumentsCamelCase<CastArgs>) => {
    const optionIndices = (argv.options as string).split(',').map(s => parseInt(s.trim(), 10));
    const weights = (argv.weights as string).split(',').map(s => parseInt(s.trim(), 10));

    if (optionIndices.length !== weights.length) {
      output.error('Number of options must match number of weights');
      process.exit(1);
      return;
    }

    if (weights.some(w => w < 0)) {
      output.error('Weights must be non-negative');
      process.exit(1);
      return;
    }

    const weightSum = weights.reduce((a, b) => a + b, 0);
    if (weightSum !== 100) {
      output.error(`Weights must sum to 100, got ${weightSum}`);
      process.exit(1);
      return;
    }

    const spin = output.spinner('Casting vote...');
    spin.start();

    try {
      const contracts = await resolveVotingContracts(argv.org, argv.chain);
      const { signer } = createSigner({ privateKey: argv.privateKey as string, chainId: argv.chain, rpcUrl: argv.rpc as string });

      const isHybrid = argv.type === 'hybrid';
      const contractAddr = isHybrid ? contracts.hybridVotingAddress : contracts.ddVotingAddress;
      if (!contractAddr) {
        throw new Error(`${isHybrid ? 'HybridVoting' : 'DirectDemocracyVoting'} not deployed for this org`);
      }

      const abiName = isHybrid ? 'HybridVotingNew' : 'DirectDemocracyVotingNew';
      const contract = createWriteContract(contractAddr, abiName, signer);

      const result = await executeTx(
        contract,
        'vote',
        [argv.proposal, optionIndices, weights],
        { dryRun: argv.dryRun }
      );

      spin.stop();

      if (result.success) {
        output.success(`Vote cast on proposal #${argv.proposal}`, {
          txHash: result.txHash, explorerUrl: result.explorerUrl,
          options: optionIndices.join(','),
          weights: weights.join(','),
        });
      } else {
        output.error('Vote failed', { error: result.error, errorCode: result.errorCode });
        process.exit(2);
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
