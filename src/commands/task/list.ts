import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import { query } from '../../lib/subgraph';
import { resolveOrgId } from '../../lib/resolve';
import { FETCH_PROJECTS_DATA } from '../../queries/task';
import { formatAddress } from '../../lib/encoding';
import * as output from '../../lib/output';

interface ListArgs {
  org: string;
  project?: string;
  status?: string;
  assignee?: string;
  mine?: boolean;
  open?: boolean;
  'for-review'?: boolean;
  'sort-by'?: string;
  limit?: number;
  chain?: number;
  'private-key'?: string;
}

export const listHandler = {
  builder: (yargs: Argv) => yargs
    .option('project', { type: 'string', describe: 'Filter by project ID' })
    .option('status', { type: 'string', describe: 'Filter by status (Open/Assigned/Submitted/Completed/Cancelled)' })
    .option('assignee', { type: 'string', describe: 'Filter by assignee address' })
    .option('mine', { type: 'boolean', describe: 'Show only tasks assigned to me' })
    .option('open', { type: 'boolean', describe: 'Shortcut for --status Open' })
    .option('for-review', { type: 'boolean', describe: 'Shortcut for --status Submitted' })
    .option('sort-by', { type: 'string', choices: ['id', 'payout', 'status', 'created'], default: 'id', describe: 'Sort field' })
    .option('limit', { type: 'number', describe: 'Max results to show' }),

  handler: async (argv: ArgumentsCamelCase<ListArgs>) => {
    const spin = output.spinner('Fetching tasks...');
    spin.start();

    try {
      const orgId = await resolveOrgId(argv.org, argv.chain);
      const result = await query<any>(FETCH_PROJECTS_DATA, { orgId }, argv.chain);

      if (!result.organization?.taskManager?.projects) {
        spin.stop();
        output.info('No projects found for this organization');
        return;
      }

      // Resolve --mine to the signer's address
      let myAddress: string | undefined;
      if (argv.mine) {
        const key = argv.privateKey as string || process.env.POP_PRIVATE_KEY;
        if (!key) {
          spin.stop();
          output.error('--mine requires a private key (set POP_PRIVATE_KEY or pass --private-key)');
          process.exit(1);
          return;
        }
        myAddress = new ethers.Wallet(key).address.toLowerCase();
      }

      // Resolve shortcut flags
      const statusFilter = argv.open ? 'open'
        : argv.forReview ? 'submitted'
        : argv.status?.toLowerCase();

      const projects = result.organization.taskManager.projects;
      let rows: Array<{ id: string; name: string; status: string; assignee: string; payout: number; payoutDisplay: string; project: string; createdAt: string; rejections: string }> = [];

      for (const project of projects) {
        if (argv.project && !project.id.includes(argv.project)) continue;

        for (const task of project.tasks || []) {
          if (statusFilter && task.status.toLowerCase() !== statusFilter) continue;
          if (argv.assignee && task.assignee?.toLowerCase() !== argv.assignee.toLowerCase()) continue;
          if (myAddress && task.assignee?.toLowerCase() !== myAddress) continue;

          const payout = parseFloat(ethers.utils.formatUnits(task.payout || '0', 18));
          const rejCount = parseInt(task.rejectionCount || '0');
          rows.push({
            id: task.taskId,
            name: task.title || task.metadata?.name || 'Untitled',
            status: rejCount > 0 && task.status === 'Assigned' ? `Rejected(${rejCount})` : task.status,
            assignee: task.assigneeUsername || formatAddress(task.assignee || ''),
            payout,
            payoutDisplay: `${payout} PT`,
            project: project.title || 'Unknown',
            createdAt: task.createdAt || '0',
            rejections: rejCount.toString(),
          });
        }
      }

      // Sort
      const sortKey = argv.sortBy || 'id';
      rows.sort((a, b) => {
        if (sortKey === 'payout') return b.payout - a.payout;
        if (sortKey === 'status') return a.status.localeCompare(b.status);
        if (sortKey === 'created') return parseInt(b.createdAt) - parseInt(a.createdAt);
        return parseInt(a.id) - parseInt(b.id);
      });

      // Limit
      if (argv.limit && argv.limit > 0) {
        rows = rows.slice(0, argv.limit);
      }

      spin.stop();

      if (rows.length === 0) {
        output.info('No tasks found matching filters');
        return;
      }

      output.table(
        ['ID', 'Name', 'Status', 'Assignee', 'Payout', 'Project'],
        rows.map(r => [r.id, r.name, r.status, r.assignee, r.payoutDisplay, r.project])
      );
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
