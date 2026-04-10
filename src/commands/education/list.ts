import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import { query } from '../../lib/subgraph';
import { resolveOrgModules } from '../../lib/resolve';
import * as output from '../../lib/output';

interface ListArgs {
  org: string;
  chain?: number;
}

const FETCH_EDUCATION_DATA = `
  query FetchEducationData($orgId: Bytes!) {
    organization(id: $orgId) {
      id
      educationHub {
        id
        modules(first: 50) {
          id
          moduleId
          title
          contentHash
          metadata {
            description
            link
            quiz
            answersJson
          }
          payout
          status
          createdAt
          completions {
            learner
            completedAt
          }
        }
      }
    }
  }
`;

export const listHandler = {
  builder: (yargs: Argv) => yargs,

  handler: async (argv: ArgumentsCamelCase<ListArgs>) => {
    const spin = output.spinner('Fetching education modules...');
    spin.start();

    try {
      const modules_ = await resolveOrgModules(argv.org, argv.chain);
      const result = await query<any>(FETCH_EDUCATION_DATA, { orgId: modules_.orgId }, argv.chain);
      const modules = result.organization?.educationHub?.modules || [];

      spin.stop();

      if (modules.length === 0) {
        output.info('No education modules found');
        return;
      }

      const rows = modules.map((m: any) => {
        const payout = ethers.utils.formatUnits(m.payout || '0', 18);
        const completions = (m.completions || []).length;
        return [
          m.moduleId,
          m.title || m.metadata?.name || 'Untitled',
          m.status,
          `${payout} PT`,
          `${completions}`,
          m.metadata?.link || '',
        ];
      });

      output.table(
        ['ID', 'Title', 'Status', 'Reward', 'Completions', 'Link'],
        rows
      );
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
