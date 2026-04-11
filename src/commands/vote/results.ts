import type { Argv, ArgumentsCamelCase } from 'yargs';
import * as output from '../../lib/output';
import { query } from '../../lib/subgraph';
import { resolveOrgModules } from '../../lib/resolve';

interface ResultsArgs {
  org: string;
  proposal: number;
  chain?: number;
}

export const resultsHandler = {
  builder: (yargs: Argv) => yargs
    .option('proposal', { type: 'number', demandOption: true, describe: 'Proposal ID' }),

  handler: async (argv: ArgumentsCamelCase<ResultsArgs>) => {
    const spin = output.spinner(`Fetching results for proposal #${argv.proposal}...`);
    spin.start();

    try {
      const modules = await resolveOrgModules(argv.org, argv.chain);
      const orgId = modules.orgId;

      const q = `{
        organization(id: "${orgId}") {
          hybridVoting {
            proposals(where: {proposalId: ${argv.proposal}}) {
              proposalId title status
              metadata { description optionNames }
              votes { voterUsername optionIndexes optionWeights }
            }
          }
        }
      }`;

      const result = await query<any>(q, {}, argv.chain);
      const proposal = result.organization?.hybridVoting?.proposals?.[0];
      if (!proposal) throw new Error(`Proposal #${argv.proposal} not found`);

      const optionNames = proposal.metadata?.optionNames || [];
      const votes = proposal.votes || [];

      // Tally weighted votes per option
      const tallies: number[] = new Array(Math.max(optionNames.length, 1)).fill(0);
      for (const v of votes) {
        for (let i = 0; i < (v.optionIndexes || []).length; i++) {
          const idx = parseInt(v.optionIndexes[i]);
          const weight = parseInt(v.optionWeights[i]);
          if (idx < tallies.length) tallies[idx] += weight;
        }
      }

      // Rank options
      const ranked = optionNames.map((name: string, i: number) => ({
        rank: 0,
        option: i,
        name,
        score: tallies[i] || 0,
      })).sort((a: any, b: any) => b.score - a.score);

      ranked.forEach((r: any, i: number) => { r.rank = i + 1; });

      // Per-voter breakdown
      const voterBreakdown = votes.map((v: any) => {
        const allocations: Record<string, number> = {};
        for (let i = 0; i < (v.optionIndexes || []).length; i++) {
          const idx = parseInt(v.optionIndexes[i]);
          const name = optionNames[idx] || `Option ${idx}`;
          allocations[name] = parseInt(v.optionWeights[i]);
        }
        return { voter: v.voterUsername || 'unknown', allocations };
      });

      const report: any = {
        proposalId: proposal.proposalId,
        title: proposal.title,
        status: proposal.status,
        totalVoters: votes.length,
        ranking: ranked,
        voters: voterBreakdown,
        winner: ranked[0],
      };

      spin.stop();

      if (argv.json) {
        output.json(report);
      } else {
        console.log(`\n  Proposal #${proposal.proposalId}: ${proposal.title}`);
        console.log(`  Status: ${proposal.status} | Voters: ${votes.length}`);
        console.log('  ' + '─'.repeat(50));
        for (const r of ranked) {
          const bar = '█'.repeat(Math.round(r.score / 5));
          console.log(`  #${r.rank} ${r.name}: ${r.score} ${bar}`);
        }
        console.log('');
        for (const v of voterBreakdown) {
          const alloc = Object.entries(v.allocations).map(([k, val]) => `${k}:${val}%`).join(', ');
          console.log(`  ${v.voter}: ${alloc}`);
        }
        console.log('');
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
