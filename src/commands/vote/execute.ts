import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import { createSigner } from '../../lib/signer';
import { createWriteContract } from '../../lib/contracts';
import { executeTx } from '../../lib/tx';
import { query } from '../../lib/subgraph';
import { resolveOrgModules } from '../../lib/resolve';
import * as output from '../../lib/output';

interface ExecuteArgs {
  org: string;
  proposal: number;
  chain?: number;
  rpc?: string;
  'private-key'?: string;
  'dry-run'?: boolean;
}

export const executeHandler = {
  builder: (yargs: Argv) => yargs
    .option('proposal', { type: 'number', demandOption: true, describe: 'Proposal ID' }),

  handler: async (argv: ArgumentsCamelCase<ExecuteArgs>) => {
    const spin = output.spinner('Executing proposal calls...');
    spin.start();

    try {
      const modules = await resolveOrgModules(argv.org, argv.chain);
      const { signer } = createSigner({ privateKey: argv.privateKey as string, chainId: argv.chain, rpcUrl: argv.rpc as string });

      const executorAddr = modules.executorAddress;
      if (!executorAddr) {
        throw new Error('No executor contract found for this org');
      }

      // Query the proposal to get its execution batches
      const proposalResult = await query<any>(`
        query GetProposal($votingId: String!, $proposalId: String!) {
          proposals(where: { hybridVoting: $votingId, proposalId: $proposalId }, first: 1) {
            proposalId
            status
            winningOption
            wasExecuted
            executionBatches {
              optionIndex
              calls {
                target
                value
                data
              }
            }
          }
        }
      `, {
        votingId: modules.hybridVotingAddress,
        proposalId: argv.proposal.toString(),
      }, argv.chain);

      const proposal = proposalResult.proposals?.[0];
      if (!proposal) {
        throw new Error(`Proposal #${argv.proposal} not found`);
      }

      if (proposal.wasExecuted) {
        spin.stop();
        output.info(`Proposal #${argv.proposal} was already executed`);
        return;
      }

      if (proposal.status !== 'Ended') {
        throw new Error(`Proposal #${argv.proposal} is still ${proposal.status} — must be Ended to execute`);
      }

      // Get the winning option's batch
      const winningBatch = proposal.executionBatches?.find(
        (b: any) => b.optionIndex === proposal.winningOption
      );

      if (!winningBatch?.calls?.length) {
        spin.stop();
        output.info(`Proposal #${argv.proposal} winning option has no execution calls`);
        return;
      }

      const batch = winningBatch.calls.map((c: any) => [c.target, c.value, c.data]);

      spin.text = 'Sending execution transaction...';
      const contract = createWriteContract(executorAddr, 'Executor', signer);
      const result = await executeTx(
        contract,
        'execute',
        [argv.proposal, batch],
        { dryRun: argv.dryRun }
      );

      spin.stop();

      if (result.success) {
        output.success(`Proposal #${argv.proposal} executed`, {
          txHash: result.txHash,
          explorerUrl: result.explorerUrl,
          callsExecuted: batch.length,
        });
      } else {
        output.error('Execution failed', { error: result.error, errorCode: result.errorCode });
        process.exit(2);
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
