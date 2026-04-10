import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import { query } from '../../lib/subgraph';
import { resolveOrgModules } from '../../lib/resolve';
import { FETCH_ORG_ACTIVITY } from '../../queries/activity';
import * as output from '../../lib/output';

interface StatusArgs {
  org?: string;
  chain?: number;
}

export const statusHandler = {
  builder: (yargs: Argv) => yargs,

  handler: async (argv: ArgumentsCamelCase<StatusArgs>) => {
    const spin = output.spinner('Fetching org status...');
    spin.start();

    try {
      const modules = await resolveOrgModules(argv.org, argv.chain);

      const result = await query<any>(FETCH_ORG_ACTIVITY, {
        orgId: modules.orgId,
        hybridVotingId: modules.hybridVotingAddress || '',
        eligibilityModuleId: modules.eligibilityModuleAddress || '',
        tokenAddress: modules.participationTokenAddress || '',
      }, argv.chain);

      spin.stop();

      const org = result.organization;
      if (!org) {
        output.error('Organization not found');
        process.exit(1);
        return;
      }

      // Count tasks
      const allTasks: any[] = [];
      for (const project of org.taskManager?.projects || []) {
        for (const task of project.tasks || []) {
          allTasks.push(task);
        }
      }
      const taskStats = {
        open: allTasks.filter(t => t.status === 'Open').length,
        assigned: allTasks.filter(t => t.status === 'Assigned').length,
        submitted: allTasks.filter(t => t.status === 'Submitted').length,
        completed: allTasks.filter(t => t.status === 'Completed').length,
      };

      // Members
      const allUsers = org.users || [];
      const activeMembers = allUsers.filter((u: any) => u.membershipStatus === 'Active');

      // Proposals
      const activeHybrid = result.activeHybridProposals || [];
      const activeDD = org.directDemocracyVoting?.ddvProposals || [];
      const activeProposals = activeHybrid.length + activeDD.length;

      // Token
      const tokenSupply = org.participationToken?.totalSupply
        ? ethers.utils.formatUnits(org.participationToken.totalSupply, 18)
        : '0';
      const tokenSymbol = org.participationToken?.symbol || 'PT';

      // Vouches & requests
      const activeVouches = result.activeVouches || [];
      const pendingRequests = result.pendingTokenRequests || [];

      if (output.isJsonMode()) {
        output.json({
          name: org.name,
          members: activeMembers.length,
          tokenSupply,
          tokenSymbol,
          activeProposals,
          tasks: taskStats,
          activeVouches: activeVouches.length,
          pendingTokenRequests: pendingRequests.length,
          distributions: org.paymentManager?.distributionCounter || '0',
        });
      } else {
        console.log('');
        console.log(`  ${org.name}`);
        console.log('  ' + '─'.repeat(40));
        console.log(`  Members:      ${activeMembers.length}`);
        console.log(`  Token Supply: ${tokenSupply} ${tokenSymbol}`);
        console.log(`  Proposals:    ${activeProposals} active`);
        console.log(`  Tasks:        ${taskStats.open} open, ${taskStats.assigned} assigned, ${taskStats.submitted} review, ${taskStats.completed} done`);
        if (activeVouches.length > 0) {
          console.log(`  Vouches:      ${activeVouches.length} pending`);
        }
        if (pendingRequests.length > 0) {
          console.log(`  Token Reqs:   ${pendingRequests.length} pending`);
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
