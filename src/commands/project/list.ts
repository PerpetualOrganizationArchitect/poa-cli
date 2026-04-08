import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import { query } from '../../lib/subgraph';
import { FETCH_PROJECTS_DATA } from '../../queries/task';
import * as output from '../../lib/output';

interface ListArgs {
  org: string;
  chain?: number;
}

export const listHandler = {
  builder: (yargs: Argv) => yargs,

  handler: async (argv: ArgumentsCamelCase<ListArgs>) => {
    const spin = output.spinner('Fetching projects...');
    spin.start();

    try {
      const result = await query<any>(FETCH_PROJECTS_DATA, { orgId: argv.org }, argv.chain);
      const projects = result.organization?.taskManager?.projects || [];

      spin.stop();

      if (projects.length === 0) {
        output.info('No projects found');
        return;
      }

      const rows = projects.map((p: any) => {
        const taskCount = (p.tasks || []).length;
        const openTasks = (p.tasks || []).filter((t: any) => t.status === 'Open').length;
        const completedTasks = (p.tasks || []).filter((t: any) => t.status === 'Completed').length;
        const cap = p.cap ? ethers.utils.formatUnits(p.cap, 18) : 'unlimited';
        return [
          p.id,
          p.title || 'Untitled',
          cap,
          `${taskCount} (${openTasks} open, ${completedTasks} done)`,
          p.createdAt ? new Date(parseInt(p.createdAt) * 1000).toLocaleDateString() : '',
        ];
      });

      output.table(['ID', 'Name', 'PT Cap', 'Tasks', 'Created'], rows);
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
