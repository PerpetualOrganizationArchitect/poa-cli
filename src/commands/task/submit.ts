import type { Argv, ArgumentsCamelCase } from 'yargs';
import { execFileSync } from 'child_process';
import { createSigner } from '../../lib/signer';
import { createWriteContract } from '../../lib/contracts';
import { executeTx } from '../../lib/tx';
import { pinJson } from '../../lib/ipfs';
import { parseTaskId, ipfsCidToBytes32 } from '../../lib/encoding';
import { query } from '../../lib/subgraph';
import { resolveOrgId } from '../../lib/resolve';
import { FETCH_PROJECTS_DATA } from '../../queries/task';
import * as output from '../../lib/output';
import { resolveOrgContracts } from './helpers';

interface SubmitArgs {
  org: string;
  task: string;
  submission: string;
  chain?: number;
  rpc?: string;
  'private-key'?: string;
  'dry-run'?: boolean;
  commit?: boolean;
  commitFiles?: string;
}

export const submitHandler = {
  builder: (yargs: Argv) => yargs
    .option('task', { type: 'string', demandOption: true, describe: 'Task ID' })
    .option('submission', { type: 'string', demandOption: true, describe: 'Submission text' })
    .option('commit', {
      type: 'boolean',
      default: false,
      describe:
        'Task #355 (HB#185): after a successful submission, run git add + git commit on the files passed via --commit-files. The commit message references the task id and tx hash. Pre-commit hook failures are surfaced as warnings — the on-chain submission is the source of truth and is never rolled back.',
    })
    .option('commit-files', {
      type: 'string',
      describe:
        'Comma-separated list of files to git add + commit when --commit is set. Required if --commit is true; ignored otherwise. Use specific paths only — never . or -A — to avoid sweeping in cross-agent in-flight work.',
    }),

  handler: async (argv: ArgumentsCamelCase<SubmitArgs>) => {
    const spin = output.spinner('Submitting task...');
    spin.start();

    try {
      const { taskManagerAddress } = await resolveOrgContracts(argv.org, argv.chain);
      const { signer } = createSigner({ privateKey: argv.privateKey as string, chainId: argv.chain, rpcUrl: argv.rpc as string });

      // Fetch existing task metadata so we preserve it in the submission
      spin.text = 'Fetching task metadata...';
      const orgId = await resolveOrgId(argv.org, argv.chain);
      const taskData = await query<any>(FETCH_PROJECTS_DATA, { orgId }, argv.chain);
      const projects = taskData.organization?.taskManager?.projects || [];
      let existingMeta: any = null;
      for (const project of projects) {
        for (const task of project.tasks || []) {
          if (task.taskId === argv.task || task.id.endsWith(`-${argv.task}`)) {
            existingMeta = task.metadata;
            break;
          }
        }
        if (existingMeta) break;
      }

      // Merge submission into existing metadata (preserves name, description, difficulty, etc.)
      const submissionMetadata = {
        name: existingMeta?.name || '',
        description: existingMeta?.description || '',
        location: existingMeta?.location || '',
        difficulty: existingMeta?.difficulty || '',
        estHours: existingMeta?.estimatedHours ? parseFloat(existingMeta.estimatedHours) : 0,
        submission: argv.submission,
      };

      spin.text = 'Pinning submission to IPFS...';
      const cid = await pinJson(JSON.stringify(submissionMetadata));
      const submissionHash = ipfsCidToBytes32(cid);

      spin.text = 'Sending transaction...';
      const contract = createWriteContract(taskManagerAddress, 'TaskManagerNew', signer);
      const parsedTaskId = parseTaskId(argv.task);
      const result = await executeTx(contract, 'submitTask', [parsedTaskId, submissionHash], { dryRun: argv.dryRun });
      spin.stop();

      if (result.success) {
        output.success(`Task ${argv.task} submitted`, { txHash: result.txHash, explorerUrl: result.explorerUrl, ipfsCid: cid });

        // Task #355 (HB#185): optional auto-commit. Runs git add + git
        // commit on the explicit files list AFTER the on-chain
        // submission lands. Failure here is a warning, not an error —
        // the submission is the source of truth and we never roll it
        // back over a git issue.
        if (argv.commit) {
          const filesArg = (argv.commitFiles ?? '').trim();
          if (!filesArg) {
            output.error(
              '--commit was set but --commit-files is empty. Pass a comma-separated list of paths to commit. Skipping git commit.',
            );
          } else {
            const files = filesArg
              .split(',')
              .map((f) => f.trim())
              .filter((f) => f.length > 0);
            // Belt-and-suspenders: refuse the dangerous "all-files" patterns.
            const dangerous = files.find((f) => f === '.' || f === '-A' || f === '--all');
            if (dangerous) {
              output.error(
                `--commit-files contains "${dangerous}" which would sweep in cross-agent in-flight work. Pass explicit paths only. Skipping git commit.`,
              );
            } else {
              try {
                execFileSync('git', ['add', '--', ...files], { stdio: ['ignore', 'pipe', 'pipe'] });
                const taskTitle = (existingMeta?.name as string | undefined) ?? `Task ${argv.task}`;
                const commitMsg =
                  `Task #${argv.task}: ${taskTitle} — submitted via pop task submit\n\n` +
                  `txHash: ${result.txHash}\n` +
                  `ipfsCid: ${cid}\n\n` +
                  `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>\n`;
                execFileSync('git', ['commit', '-m', commitMsg], { stdio: ['ignore', 'pipe', 'pipe'] });
                const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
                  stdio: ['ignore', 'pipe', 'pipe'],
                })
                  .toString()
                  .trim();
                console.log(`  git commit: ${sha} (${files.length} file${files.length === 1 ? '' : 's'})`);
              } catch (gitErr: any) {
                // Common: pre-commit hook failure, no changes to commit, etc.
                // Surface the stderr if available so the operator can fix it.
                const stderr = gitErr?.stderr ? gitErr.stderr.toString().trim() : '';
                output.error(
                  `git commit failed (submission already on-chain — fix manually): ${gitErr.message}` +
                    (stderr ? `\n${stderr}` : ''),
                );
              }
            }
          }
        }
      } else {
        output.error('Submission failed', { error: result.error, errorCode: result.errorCode });
        process.exit(2);
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
