import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import { query } from '../../lib/subgraph';
import { resolveOrgModules } from '../../lib/resolve';
import * as output from '../../lib/output';

interface MembersArgs {
  org?: string;
  chain?: number;
}

const FETCH_MEMBERS = `
  query FetchMembers($orgId: Bytes!) {
    organization(id: $orgId) {
      participationToken {
        totalSupply
      }
      users(orderBy: participationTokenBalance, orderDirection: desc, first: 100) {
        address
        participationTokenBalance
        membershipStatus
        totalTasksCompleted
        totalVotes
        firstSeenAt
        account {
          username
        }
      }
    }
  }
`;

export const membersHandler = {
  builder: (yargs: Argv) => yargs,

  handler: async (argv: ArgumentsCamelCase<MembersArgs>) => {
    const spin = output.spinner('Fetching members...');
    spin.start();

    try {
      const modules = await resolveOrgModules(argv.org, argv.chain);
      const result = await query<any>(FETCH_MEMBERS, { orgId: modules.orgId }, argv.chain);
      const org = result.organization;

      if (!org) throw new Error('Organization not found');

      const totalSupply = ethers.BigNumber.from(org.participationToken?.totalSupply || '0');
      const activeMembers = org.users.filter((u: any) => u.membershipStatus === 'Active');

      const memberData = activeMembers.map((u: any) => {
        const pt = ethers.BigNumber.from(u.participationTokenBalance || '0');
        const sharePercent = totalSupply.gt(0)
          ? pt.mul(10000).div(totalSupply).toNumber() / 100
          : 0;
        const joinDate = u.firstSeenAt
          ? new Date(parseInt(u.firstSeenAt) * 1000).toISOString().split('T')[0]
          : 'unknown';

        return {
          username: u.account?.username || null,
          address: u.address,
          pt: ethers.utils.formatEther(pt),
          share: `${sharePercent.toFixed(1)}%`,
          tasksCompleted: parseInt(u.totalTasksCompleted || '0'),
          votesCast: parseInt(u.totalVotes || '0'),
          joined: joinDate,
        };
      });

      spin.stop();

      if (output.isJsonMode()) {
        output.json({ totalSupply: ethers.utils.formatEther(totalSupply), members: memberData });
      } else {
        console.log('');
        console.log(`  Members (${memberData.length} active, ${ethers.utils.formatEther(totalSupply)} PT total)`);
        console.log('  ─────────────────────────────────────────────────────────────');
        console.log('  ' + 'Username'.padEnd(18) + 'PT'.padStart(8) + 'Share'.padStart(8) + 'Tasks'.padStart(7) + 'Votes'.padStart(7) + '  Joined');
        console.log('  ' + '─'.repeat(64));
        for (const m of memberData) {
          const name = (m.username || m.address.slice(0, 10) + '...').padEnd(18);
          console.log(`  ${name}${m.pt.padStart(8)}${m.share.padStart(8)}${String(m.tasksCompleted).padStart(7)}${String(m.votesCast).padStart(7)}  ${m.joined}`);
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
