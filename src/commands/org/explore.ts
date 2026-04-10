import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import { queryAllChains } from '../../lib/subgraph';
import * as output from '../../lib/output';

interface ExploreArgs {
  chain?: number;
}

const EXPLORE_QUERY = `
  query ExploreOrgs($first: Int!) {
    organizations(first: $first, orderBy: deployedAt, orderDirection: desc) {
      id
      name
      deployedAt
      users(first: 100) {
        membershipStatus
      }
      taskManager {
        projects(where: { deleted: false }, first: 10) {
          tasks(first: 100) {
            status
            payout
          }
        }
      }
      hybridVoting {
        proposals(where: { status: "Active" }, first: 10) {
          proposalId
          title
          endTimestamp
        }
      }
      participationToken {
        totalSupply
      }
    }
  }
`;

export const exploreHandler = {
  builder: (yargs: Argv) => yargs
    .option('chain', { type: 'number', describe: 'Filter to specific chain' }),

  handler: async (argv: ArgumentsCamelCase<ExploreArgs>) => {
    const spin = output.spinner('Scanning POP orgs across chains...');
    spin.start();

    try {
      const results = await queryAllChains<any>(EXPLORE_QUERY, { first: 20 });
      spin.stop();

      const rows: any[] = [];

      for (const chainResult of results) {
        if (!chainResult.data?.organizations) continue;
        for (const org of chainResult.data.organizations) {
          const activeMembers = (org.users || []).filter((u: any) => u.membershipStatus === 'Active').length;
          if (activeMembers === 0) continue; // skip dead orgs

          // Count tasks
          let openTasks = 0;
          let completedTasks = 0;
          let totalPT = 0;
          for (const proj of org.taskManager?.projects || []) {
            for (const task of proj.tasks || []) {
              if (task.status === 'Open') openTasks++;
              if (task.status === 'Completed') completedTasks++;
              if (task.status === 'Completed') totalPT += parseFloat(ethers.utils.formatUnits(task.payout || '0', 18));
            }
          }

          const activeProposals = org.hybridVoting?.proposals?.length || 0;
          const supply = org.participationToken?.totalSupply
            ? parseFloat(ethers.utils.formatUnits(org.participationToken.totalSupply, 18))
            : 0;

          rows.push({
            name: org.name || 'Unnamed',
            chain: chainResult.name,
            members: activeMembers,
            openTasks,
            completedTasks,
            activeProposals,
            ptSupply: Math.round(supply),
          });
        }
      }

      if (rows.length === 0) {
        output.info('No active organizations found');
        return;
      }

      // Sort by activity (members + completed tasks)
      rows.sort((a, b) => (b.members + b.completedTasks) - (a.members + a.completedTasks));

      if (output.isJsonMode()) {
        output.json(rows);
      } else {
        console.log('');
        console.log('  POP Ecosystem Explorer');
        console.log('  ' + '═'.repeat(70));
        output.table(
          ['Org', 'Chain', 'Members', 'Open Tasks', 'Done', 'Proposals', 'PT Supply'],
          rows.map(r => [
            r.name,
            r.chain,
            r.members.toString(),
            r.openTasks > 0 ? `${r.openTasks} ←` : '0',
            r.completedTasks.toString(),
            r.activeProposals > 0 ? `${r.activeProposals} active` : '0',
            r.ptSupply.toString(),
          ])
        );
        console.log('');
        const withOpen = rows.filter(r => r.openTasks > 0);
        if (withOpen.length > 0) {
          console.log('  Orgs with open tasks (← potential collaboration):');
          for (const r of withOpen) {
            console.log(`    ${r.name} (${r.chain}): ${r.openTasks} open task(s)`);
          }
          console.log('');
        }
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
