import type { Argv, ArgumentsCamelCase } from 'yargs';
import { createSigner } from '../../lib/signer';
import { createWriteContract } from '../../lib/contracts';
import { executeTx } from '../../lib/tx';
import { query } from '../../lib/subgraph';
import { resolveOrgModules } from '../../lib/resolve';
import {
  argvToIdempotencyString,
  checkIdempotencyCache,
  recordIdempotentResult,
} from '../../lib/idempotency';
import * as output from '../../lib/output';

interface ExecuteArgs {
  org: string;
  proposal: number;
  chain?: number;
  rpc?: string;
  'private-key'?: string;
  'dry-run'?: boolean;
  'idempotency-key'?: string;
  'no-idempotency'?: boolean;
}

/**
 * Finalize an ended proposal by calling HybridVoting.announceWinner.
 * This is the one canonical path: announceWinner both announces the winner
 * and executes the winning option's calls through the Executor. The Executor
 * is gated to `allowedCaller()` (HybridVoting), so there is no way to execute
 * proposal calls by calling the Executor directly.
 *
 * Relationship to other commands:
 *   - `pop vote announce-all` — batch-announces all ended proposals (preferred)
 *   - `pop vote announce` — announces one (alias of this command)
 *   - `pop vote execute` — this command, kept for symmetry with the docs
 *
 * If a proposal was announced but its execution reverted (executionFailed=true),
 * that terminal state is final. The call data lives in the proposal creation tx
 * and the protocol does not expose a retry path. The fix is a new proposal.
 */
export const executeHandler = {
  builder: (yargs: Argv) => yargs
    .option('proposal', { type: 'number', demandOption: true, describe: 'Proposal ID' })
    .option('idempotency-key', { type: 'string', describe: 'Task #375 (HB#217) idempotency cache.' })
    .option('no-idempotency', { type: 'boolean', default: false, describe: 'Bypass the idempotency cache.' }),

  handler: async (argv: ArgumentsCamelCase<ExecuteArgs>) => {
    const spin = output.spinner('Checking proposal state...');
    spin.start();

    try {
      const modules = await resolveOrgModules(argv.org, argv.chain);
      const { signer } = createSigner({ privateKey: argv.privateKey as string, chainId: argv.chain, rpcUrl: argv.rpc as string });

      if (!modules.hybridVotingAddress) {
        throw new Error('No HybridVoting contract found for this org');
      }

      // Task #375 (HB#217): org-scoped idempotency check
      const idempKey = argv.idempotencyKey || argvToIdempotencyString(argv as Record<string, any>);
      if (!argv.noIdempotency) {
        const cached = checkIdempotencyCache(modules.orgId, 'vote.execute', idempKey);
        if (cached) {
          spin.stop();
          output.success(`Proposal #${argv.proposal} already finalized (idempotency cache hit)`, { ...cached, cached: true });
          return;
        }
      }

      // Check proposal state via subgraph
      const proposalResult = await query<any>(`
        query GetProposal($votingId: String!, $proposalId: String!) {
          proposals(where: { hybridVoting: $votingId, proposalId: $proposalId }, first: 1) {
            proposalId
            status
            winningOption
            wasExecuted
            executionFailed
            isValid
            winnerAnnouncedAt
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

      if (proposal.executionFailed) {
        spin.stop();
        output.error(
          `Proposal #${argv.proposal} was announced but execution reverted on-chain. ` +
          `This is a terminal state — the protocol has no retry path. ` +
          `Create a new proposal to retry the intended action.`
        );
        process.exit(2);
        return;
      }

      if (proposal.winnerAnnouncedAt) {
        spin.stop();
        output.info(
          `Proposal #${argv.proposal} winner is already announced (valid=${proposal.isValid}). ` +
          `Nothing to do.`
        );
        return;
      }

      if (proposal.status !== 'Ended') {
        throw new Error(`Proposal #${argv.proposal} is still ${proposal.status} — must be Ended to finalize`);
      }

      // Announce + execute via HybridVoting.announceWinner (the canonical path)
      spin.text = 'Announcing winner (this also executes calls)...';
      const contract = createWriteContract(modules.hybridVotingAddress, 'HybridVotingNew', signer);
      const result = await executeTx(
        contract,
        'announceWinner',
        [argv.proposal],
        { dryRun: argv.dryRun }
      );

      spin.stop();

      if (result.success) {
        if (!argv.noIdempotency) {
          recordIdempotentResult(modules.orgId, 'vote.execute', idempKey, {
            proposal: argv.proposal,
            txHash: result.txHash,
          });
        }
        output.success(`Proposal #${argv.proposal} finalized`, {
          txHash: result.txHash,
          explorerUrl: result.explorerUrl,
        });
      } else {
        output.error('Finalization failed', { error: result.error, errorCode: result.errorCode });
        process.exit(2);
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
