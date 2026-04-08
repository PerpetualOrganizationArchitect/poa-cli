import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import { query } from '../../lib/subgraph';
import { resolveOrgId } from '../../lib/resolve';
import { fetchJson } from '../../lib/ipfs';
import { FETCH_PROJECTS_DATA } from '../../queries/task';
import { formatAddress } from '../../lib/encoding';
import * as output from '../../lib/output';

interface ViewArgs {
  org: string;
  task: string;
  chain?: number;
}

export const viewHandler = {
  builder: (yargs: Argv) => yargs
    .option('task', { type: 'string', demandOption: true, describe: 'Task ID' }),

  handler: async (argv: ArgumentsCamelCase<ViewArgs>) => {
    const spin = output.spinner('Fetching task...');
    spin.start();

    try {
      const orgId = await resolveOrgId(argv.org, argv.chain);
      const result = await query<any>(FETCH_PROJECTS_DATA, { orgId }, argv.chain);
      const projects = result.organization?.taskManager?.projects || [];

      let found: any = null;
      let projectTitle = '';
      for (const project of projects) {
        for (const task of project.tasks || []) {
          if (task.taskId === argv.task || task.id.endsWith(`-${argv.task}`)) {
            found = task;
            projectTitle = project.title;
            break;
          }
        }
        if (found) break;
      }

      if (!found) {
        spin.stop();
        output.error(`Task ${argv.task} not found`);
        process.exit(1);
        return;
      }

      // Try to fetch IPFS metadata for richer details
      let metadata = found.metadata || null;
      if (!metadata && found.metadataHash) {
        try {
          metadata = await fetchJson(found.metadataHash);
        } catch { /* ignore */ }
      }

      spin.stop();

      const payout = ethers.utils.formatUnits(found.payout || '0', 18);
      const bountyPayout = found.bountyPayout && found.bountyToken !== ethers.constants.AddressZero
        ? found.bountyPayout
        : null;

      if (output.isJsonMode()) {
        output.json({
          taskId: found.taskId,
          title: found.title || metadata?.name,
          description: metadata?.description,
          status: found.status,
          project: projectTitle,
          payout: payout + ' PT',
          bountyToken: found.bountyToken,
          bountyPayout: bountyPayout,
          assignee: found.assignee,
          assigneeUsername: found.assigneeUsername,
          completer: found.completer,
          difficulty: metadata?.difficulty,
          estHours: metadata?.estimatedHours || metadata?.estHours,
          location: metadata?.location,
          submission: metadata?.submission,
          requiresApplication: found.requiresApplication,
          applications: found.applications,
          createdAt: found.createdAt,
          assignedAt: found.assignedAt,
          submittedAt: found.submittedAt,
          completedAt: found.completedAt,
        });
      } else {
        console.log('');
        console.log(`  Task #${found.taskId}: ${found.title || metadata?.name || 'Untitled'}`);
        console.log(`  Project:     ${projectTitle}`);
        console.log(`  Status:      ${found.status}`);
        console.log(`  Payout:      ${payout} PT`);
        if (bountyPayout) console.log(`  Bounty:      ${bountyPayout} (${formatAddress(found.bountyToken)})`);
        if (found.assignee) console.log(`  Assignee:    ${found.assigneeUsername || found.assignee}`);
        if (found.completer) console.log(`  Completer:   ${found.completerUsername || found.completer}`);
        if (metadata?.description) console.log(`  Description: ${metadata.description}`);
        if (metadata?.difficulty) console.log(`  Difficulty:  ${metadata.difficulty}`);
        if (metadata?.estimatedHours || metadata?.estHours) console.log(`  Est Hours:   ${metadata.estimatedHours || metadata.estHours}`);
        if (metadata?.location) console.log(`  Location:    ${metadata.location}`);
        if (found.requiresApplication) console.log(`  Requires Application: yes`);
        if (found.applications?.length) {
          console.log(`  Applications: ${found.applications.length}`);
          for (const app of found.applications) {
            console.log(`    - ${app.applicantUsername || formatAddress(app.applicant)} (approved: ${app.approved})`);
          }
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
