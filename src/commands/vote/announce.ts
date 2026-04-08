import type { Argv, ArgumentsCamelCase } from 'yargs';
import { createSigner } from '../../lib/signer';
import { createWriteContract } from '../../lib/contracts';
import { executeTx } from '../../lib/tx';
import * as output from '../../lib/output';
import { resolveVotingContracts } from './helpers';

interface AnnounceArgs {
  org: string;
  type: string;
  proposal: number;
  chain?: number;
  rpc?: string;
  'private-key'?: string;
  'dry-run'?: boolean;
}

export const announceHandler = {
  builder: (yargs: Argv) => yargs
    .option('type', { type: 'string', demandOption: true, choices: ['hybrid', 'dd'], describe: 'Voting type' })
    .option('proposal', { type: 'number', demandOption: true, describe: 'Proposal ID' }),

  handler: async (argv: ArgumentsCamelCase<AnnounceArgs>) => {
    const spin = output.spinner('Announcing winner...');
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
        'announceWinner',
        [argv.proposal],
        { dryRun: argv.dryRun }
      );

      spin.stop();

      if (result.success) {
        output.success(`Winner announced for proposal #${argv.proposal}`, { txHash: result.txHash, explorerUrl: result.explorerUrl });
      } else {
        output.error('Announcement failed', { error: result.error, errorCode: result.errorCode });
        process.exit(2);
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
