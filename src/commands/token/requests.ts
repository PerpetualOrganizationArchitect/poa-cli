import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import { query } from '../../lib/subgraph';
import { FETCH_PENDING_TOKEN_REQUESTS, FETCH_ALL_TOKEN_REQUESTS } from '../../queries/token';
import { formatAddress } from '../../lib/encoding';
import * as output from '../../lib/output';
import { resolveTokenAddress } from './helpers';

interface RequestsArgs {
  org?: string;
  status?: string;
  chain?: number;
}

export const requestsHandler = {
  builder: (yargs: Argv) => yargs
    .option('status', { type: 'string', choices: ['pending', 'all'], default: 'pending', describe: 'Filter by status' }),

  handler: async (argv: ArgumentsCamelCase<RequestsArgs>) => {
    const spin = output.spinner('Fetching token requests...');
    spin.start();

    try {
      const { tokenAddress } = await resolveTokenAddress(argv.org, argv.chain);

      const gqlQuery = argv.status === 'all' ? FETCH_ALL_TOKEN_REQUESTS : FETCH_PENDING_TOKEN_REQUESTS;
      const result = await query<any>(gqlQuery, { tokenAddress }, argv.chain);
      const requests = result.tokenRequests || [];

      spin.stop();

      if (requests.length === 0) {
        output.info('No token requests found');
        return;
      }

      const rows = requests.map((r: any) => {
        const amount = ethers.utils.formatUnits(r.amount || '0', 18);
        return [
          r.requestId,
          formatAddress(r.requester || ''),
          `${amount} PT`,
          r.metadata?.reason || '',
          r.status,
          r.createdAt ? new Date(parseInt(r.createdAt) * 1000).toLocaleDateString() : '',
        ];
      });

      output.table(['ID', 'Requester', 'Amount', 'Reason', 'Status', 'Date'], rows);
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
