import type { Argv, ArgumentsCamelCase } from 'yargs';
import { query } from '../../lib/subgraph';
import { resolveEligibilityModule } from './helpers';
import { FETCH_VOUCHES_FOR_ORG } from '../../queries/vouch';
import { formatAddress } from '../../lib/encoding';
import * as output from '../../lib/output';

interface ListArgs {
  org?: string;
  hat?: string;
  chain?: number;
}

export const listHandler = {
  builder: (yargs: Argv) => yargs
    .option('hat', { type: 'string', describe: 'Filter by hat ID' }),

  handler: async (argv: ArgumentsCamelCase<ListArgs>) => {
    const spin = output.spinner('Fetching vouches...');
    spin.start();

    try {
      const { eligibilityModuleAddress } = await resolveEligibilityModule(argv.org, argv.chain);
      const result = await query<any>(
        FETCH_VOUCHES_FOR_ORG,
        { eligibilityModuleId: eligibilityModuleAddress },
        argv.chain
      );

      let vouches = result.vouches || [];
      if (argv.hat) {
        vouches = vouches.filter((v: any) => v.hatId === argv.hat);
      }

      spin.stop();

      if (vouches.length === 0) {
        output.info('No active vouches found');
        return;
      }

      const rows = vouches.map((v: any) => [
        v.hatId,
        v.wearerUsername || formatAddress(v.wearer),
        v.voucherUsername || formatAddress(v.voucher),
        v.vouchCount?.toString() || '?',
        v.createdAt ? new Date(parseInt(v.createdAt) * 1000).toLocaleDateString() : '',
      ]);

      output.table(['Hat', 'Wearer', 'Voucher', 'Count', 'Date'], rows);
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
