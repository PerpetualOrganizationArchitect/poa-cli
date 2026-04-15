import type { Argv, ArgumentsCamelCase } from 'yargs';
import { query } from '../../lib/subgraph';
import { resolveOrgModules } from '../../lib/resolve';
import * as output from '../../lib/output';

interface PublicationsArgs {
  org: string;
  limit?: number;
  project?: string;
  since?: string;
  chain?: number;
}

interface Publication {
  cid: string;
  url: string;
  taskId: string;
  taskTitle: string;
  project: string;
  completedAt: number;
  completer: string;
}

// Match IPFS CIDv0 (Qm...) and CIDv1 (bafy...) tokens in text
const CID_REGEX = /(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[a-z2-7]{55})/g;

function extractCids(text: string): string[] {
  if (!text) return [];
  const matches = text.match(CID_REGEX) || [];
  // Deduplicate while preserving order
  const seen = new Set<string>();
  const out: string[] = [];
  for (const cid of matches) {
    if (!seen.has(cid)) {
      seen.add(cid);
      out.push(cid);
    }
  }
  return out;
}

export const publicationsHandler = {
  builder: (yargs: Argv) => yargs
    .option('limit', { type: 'number', default: 50, describe: 'Max tasks to scan' })
    .option('project', { type: 'string', describe: 'Filter by project name' })
    .option('since', { type: 'string', describe: 'Unix timestamp — only tasks completed after this time' }),

  handler: async (argv: ArgumentsCamelCase<PublicationsArgs>) => {
    const spin = output.spinner('Indexing publications...');
    spin.start();

    try {
      const modules = await resolveOrgModules(argv.org, argv.chain);
      const limit = Math.min(Number(argv.limit) || 50, 200);
      const sinceTs = argv.since ? Number(argv.since) : 0;

      // Query completed tasks with their submission metadata
      const result = await query<any>(`
        query GetCompletedTasks($tm: String!, $limit: Int!) {
          tasks(
            where: { taskManager: $tm, status: Completed }
            orderBy: completedAt
            orderDirection: desc
            first: $limit
          ) {
            taskId
            title
            completedAt
            completerUsername
            project { title }
            metadata { submission }
          }
        }
      `, { tm: modules.taskManagerAddress, limit }, argv.chain);

      const tasks = result.tasks || [];

      const publications: Publication[] = [];
      const tasksByProject: Record<string, number> = {};

      for (const t of tasks) {
        const completedAt = Number(t.completedAt || 0);
        if (sinceTs && completedAt < sinceTs) continue;

        const projectName = t.project?.title || 'Unknown';
        if (argv.project && projectName !== argv.project) continue;

        tasksByProject[projectName] = (tasksByProject[projectName] || 0) + 1;

        const cids = extractCids(t.metadata?.submission || '');
        for (const cid of cids) {
          publications.push({
            cid,
            url: `https://ipfs.io/ipfs/${cid}`,
            taskId: t.taskId,
            taskTitle: t.title || '(untitled)',
            project: projectName,
            completedAt,
            completer: t.completerUsername || 'unknown',
          });
        }
      }

      spin.stop();

      // Summary
      const byProject: Record<string, number> = {};
      for (const p of publications) {
        byProject[p.project] = (byProject[p.project] || 0) + 1;
      }

      if (argv.json) {
        output.json({
          totalPublications: publications.length,
          tasksScanned: tasks.length,
          byProject,
          publications,
        });
      } else {
        console.log(`\n  ${publications.length} publications across ${Object.keys(byProject).length} projects (${tasks.length} tasks scanned)\n`);
        for (const [proj, count] of Object.entries(byProject).sort((a, b) => b[1] - a[1])) {
          console.log(`  ${proj}: ${count}`);
        }
        console.log('');
        for (const p of publications.slice(0, 30)) {
          const date = p.completedAt ? new Date(p.completedAt * 1000).toISOString().slice(0, 10) : '----';
          console.log(`  [${date}] #${p.taskId} ${p.project.slice(0, 20).padEnd(20)} ${p.taskTitle.slice(0, 50)}`);
          console.log(`    ${p.url}`);
        }
        if (publications.length > 30) {
          console.log(`\n  ... and ${publications.length - 30} more. Use --json for full list.`);
        }
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
