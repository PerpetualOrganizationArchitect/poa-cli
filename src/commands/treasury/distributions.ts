import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import { query } from '../../lib/subgraph';
import { resolveOrgId } from '../../lib/resolve';
import { FETCH_TREASURY_DATA } from '../../queries/treasury';
import { formatAddress } from '../../lib/encoding';
import * as output from '../../lib/output';

interface DistributionsArgs {
  org?: string;
  status?: string;
  chain?: number;
}

export const distributionsHandler = {
  builder: (yargs: Argv) => yargs
    .option('status', { type: 'string', choices: ['Active', 'Finalized'], describe: 'Filter by status' }),

  handler: async (argv: ArgumentsCamelCase<DistributionsArgs>) => {
    const spin = output.spinner('Fetching distributions...');
    spin.start();

    try {
      const orgId = await resolveOrgId(argv.org, argv.chain);
      const result = await query<any>(FETCH_TREASURY_DATA, { orgId }, argv.chain);
      let distributions = result.organization?.paymentManager?.distributions || [];

      if (argv.status) {
        distributions = distributions.filter((d: any) => d.status === argv.status);
      }

      spin.stop();

      if (distributions.length === 0) {
        output.info('No distributions found');
        return;
      }

      const rows = distributions.map((d: any) => {
        const total = ethers.utils.formatUnits(d.totalAmount || '0', 18);
        const claimed = ethers.utils.formatUnits(d.totalClaimed || '0', 18);
        const claimCount = (d.claims || []).length;
        return [
          d.distributionId,
          d.status,
          formatAddress(d.payoutToken || ''),
          total,
          `${claimed} (${claimCount} claims)`,
          d.createdAt ? new Date(parseInt(d.createdAt) * 1000).toLocaleDateString() : '',
        ];
      });

      output.table(['ID', 'Status', 'Token', 'Total', 'Claimed', 'Created'], rows);
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
