import type { Argv, ArgumentsCamelCase } from 'yargs';
import { createSigner } from '../../lib/signer';
import { createWriteContract } from '../../lib/contracts';
import { executeTx } from '../../lib/tx';
import { resolveOrgId } from '../../lib/resolve';
import {
  argvToIdempotencyString,
  checkIdempotencyCache,
  recordIdempotentResult,
} from '../../lib/idempotency';
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
  'idempotency-key'?: string;
  'no-idempotency'?: boolean;
}

export const announceHandler = {
  builder: (yargs: Argv) => yargs
    .option('type', { type: 'string', demandOption: true, choices: ['hybrid', 'dd'], describe: 'Voting type' })
    .option('proposal', { type: 'number', demandOption: true, describe: 'Proposal ID' })
    .option('force', { type: 'boolean', default: false, describe: 'Skip pre-flight check and announce anyway' })
    .option('idempotency-key', { type: 'string', describe: 'Task #375 (HB#217) idempotency cache.' })
    .option('no-idempotency', { type: 'boolean', default: false, describe: 'Bypass the idempotency cache.' }),

  handler: async (argv: ArgumentsCamelCase<AnnounceArgs>) => {
    const spin = output.spinner('Announcing winner...');
    spin.start();

    try {
      const contracts = await resolveVotingContracts(argv.org, argv.chain);
      const resolvedOrgId = await resolveOrgId(argv.org, argv.chain);
      const { signer } = createSigner({ privateKey: argv.privateKey as string, chainId: argv.chain, rpcUrl: argv.rpc as string });

      // Task #375 (HB#217): org-scoped idempotency check
      const idempKey = argv.idempotencyKey || argvToIdempotencyString(argv as Record<string, any>);
      if (!argv.noIdempotency) {
        const cached = checkIdempotencyCache(resolvedOrgId, 'vote.announce', idempKey);
        if (cached) {
          spin.stop();
          output.success(`Proposal #${argv.proposal} already announced (idempotency cache hit)`, { ...cached, cached: true });
          return;
        }
      }

      const isHybrid = argv.type === 'hybrid';
      const contractAddr = isHybrid ? contracts.hybridVotingAddress : contracts.ddVotingAddress;
      if (!contractAddr) {
        throw new Error(`${isHybrid ? 'HybridVoting' : 'DirectDemocracyVoting'} not deployed for this org`);
      }

      const abiName = isHybrid ? 'HybridVotingNew' : 'DirectDemocracyVotingNew';
      const contract = createWriteContract(contractAddr, abiName, signer);

      // Pre-flight: callStatic catches execution failures before burning gas
      spin.text = 'Pre-flight check (callStatic)...';
      try {
        await contract.callStatic.announceWinner(argv.proposal);
      } catch (preflightErr: any) {
        spin.stop();
        const reason = preflightErr?.reason || preflightErr?.error?.reason || preflightErr?.message || 'unknown';
        output.error(
          `Pre-flight check FAILED — announcement would revert.\n` +
          `  Reason: ${reason}\n` +
          `  Execution would fail on-chain. Common causes:\n` +
          `    - Executor drained by other proposals between creation and now\n` +
          `    - Bridge/oracle quote expired (for proposals with bridge calls)\n` +
          `    - Target contract paused or state changed\n` +
          `  Check current state: node dist/index.js vote simulate (with the original calls)\n` +
          `  Force anyway (not recommended): add --force`
        );
        if (!(argv as any).force) {
          process.exit(2);
        }
        spin.start();
        spin.text = 'Announcing despite pre-flight failure (--force)...';
      }

      spin.text = 'Announcing winner...';
      // minCallGas 2M floor: see announce-all.ts for the rationale. Without
      // this, proposals with execution batches (Curve+bridge style) silently
      // fail at deep subcalls due to gas forwarding starvation under the
      // default 300K UserOp callGasLimit.
      const result = await executeTx(
        contract,
        'announceWinner',
        [argv.proposal],
        {
          dryRun: argv.dryRun,
          minCallGas: 2_000_000n,
        }
      );

      spin.stop();

      if (result.success) {
        // Parse Winner event for details
        const winnerEvent = result.logs?.find(l => l.name === 'Winner');
        const executedEvent = result.logs?.find(l => l.name === 'ProposalExecuted');
        // CRITICAL: check for inner execution failures
        // The Executor catches failed sub-calls and emits CallFailed/ProposalExecutionFailed
        // events — the outer announceWinner tx still returns successfully. We need to
        // check the logs to detect this case, otherwise we'd report "success" on a
        // proposal that actually failed to execute.
        const callFailedEvents = result.logs?.filter(l => l.name === 'CallFailed') || [];
        const execFailedEvent = result.logs?.find(l => l.name === 'ProposalExecutionFailed');
        const hasInnerFailure = callFailedEvents.length > 0 || !!execFailedEvent;

        if (hasInnerFailure) {
          output.error(`Proposal #${argv.proposal} ANNOUNCED but EXECUTION FAILED`, {
            txHash: result.txHash,
            explorerUrl: result.explorerUrl,
            winningOption: winnerEvent?.args?.winningIdx?.toString(),
            failedCalls: callFailedEvents.map(e => ({
              index: e.args?.index?.toString(),
              data: e.args?.lowLevelData || e.args?.data,
            })),
            note: 'The proposal was finalized but inner execution reverted. ' +
              'Gas was burned. Diagnose by inspecting the CallFailed events in the tx, ' +
              'fix the issue, and create a new proposal. The old one cannot be re-executed.',
          });
          process.exit(2);
        }

        if (!argv.noIdempotency) {
          recordIdempotentResult(resolvedOrgId, 'vote.announce', idempKey, {
            proposal: argv.proposal,
            txHash: result.txHash,
            winningOption: winnerEvent?.args?.winningIdx?.toString(),
          });
        }

        output.success(`Winner announced for proposal #${argv.proposal}`, {
          txHash: result.txHash,
          explorerUrl: result.explorerUrl,
          winningOption: winnerEvent?.args?.winningIdx?.toString(),
          valid: winnerEvent?.args?.valid,
          executed: !!executedEvent || winnerEvent?.args?.executed,
        });
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
