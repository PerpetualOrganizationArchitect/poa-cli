import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import { query } from '../../lib/subgraph';
import { resolveOrgId } from '../../lib/resolve';
import { FETCH_VOTING_DATA } from '../../queries/voting';
import * as output from '../../lib/output';

interface ListArgs {
  org?: string;
  type?: string;
  status?: string;
  unvoted?: boolean;
  chain?: number;
  'private-key'?: string;
}

export const listHandler = {
  builder: (yargs: Argv) => yargs
    .option('type', { type: 'string', choices: ['hybrid', 'dd', 'all'], default: 'all', describe: 'Voting type filter' })
    .option('status', { type: 'string', choices: ['Active', 'Ended', 'Executed'], describe: 'Status filter' })
    .option('unvoted', { type: 'boolean', describe: 'Only show proposals where I have not voted (requires key)' }),

  handler: async (argv: ArgumentsCamelCase<ListArgs>) => {
    const spin = output.spinner('Fetching proposals...');
    spin.start();

    try {
      // Resolve signer address if --unvoted
      let myAddress: string | undefined;
      if (argv.unvoted) {
        const key = argv.privateKey as string || process.env.POP_PRIVATE_KEY;
        if (!key) {
          spin.stop();
          output.error('--unvoted requires a private key (set POP_PRIVATE_KEY or pass --private-key)');
          process.exit(1);
          return;
        }
        myAddress = new ethers.Wallet(key).address.toLowerCase();
      }

      const orgId = await resolveOrgId(argv.org, argv.chain);
      const result = await query<any>(FETCH_VOTING_DATA, { orgId }, argv.chain);
      const org = result.organization;

      if (!org) {
        spin.stop();
        output.error('Organization not found');
        process.exit(1);
        return;
      }

      const rows: string[][] = [];

      // Helper: check if address has voted on a proposal
      function hasVoted(proposal: any): boolean {
        if (!myAddress) return false;
        return (proposal.votes || []).some((v: any) => v.voter?.toLowerCase() === myAddress);
      }

      // Hybrid proposals
      if (argv.type === 'all' || argv.type === 'hybrid') {
        const proposals = org.hybridVoting?.proposals || [];
        for (const p of proposals) {
          if (argv.status && p.status !== argv.status) continue;
          if (argv.unvoted && hasVoted(p)) continue;

          const endDate = p.endTimestamp
            ? new Date(parseInt(p.endTimestamp) * 1000).toLocaleString()
            : '';
          const voteCount = (p.votes || []).length;

          const displayStatus = p.executionFailed ? 'ExecFailed' : p.status;
          rows.push([
            p.proposalId,
            'hybrid',
            p.title || p.metadata?.description?.substring(0, 40) || 'Untitled',
            displayStatus,
            `${p.numOptions}`,
            `${voteCount}`,
            p.winningOption != null ? `#${p.winningOption}` : '-',
            endDate,
          ]);
        }
      }

      // DD proposals
      if (argv.type === 'all' || argv.type === 'dd') {
        const proposals = org.directDemocracyVoting?.ddvProposals || [];
        for (const p of proposals) {
          if (argv.status && p.status !== argv.status) continue;
          if (argv.unvoted && hasVoted(p)) continue;

          const endDate = p.endTimestamp
            ? new Date(parseInt(p.endTimestamp) * 1000).toLocaleString()
            : '';
          const voteCount = (p.votes || []).length;

          const ddDisplayStatus = p.executionFailed ? 'ExecFailed' : p.status;
          rows.push([
            p.proposalId,
            'dd',
            p.title || p.metadata?.description?.substring(0, 40) || 'Untitled',
            ddDisplayStatus,
            `${p.numOptions}`,
            `${voteCount}`,
            p.winningOption != null ? `#${p.winningOption}` : '-',
            endDate,
          ]);
        }
      }

      spin.stop();

      if (rows.length === 0) {
        output.info(argv.unvoted ? 'No unvoted proposals found' : 'No proposals found');
        return;
      }

      output.table(
        ['ID', 'Type', 'Title', 'Status', 'Options', 'Votes', 'Winner', 'Ends'],
        rows
      );
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
