import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import { query } from '../../lib/subgraph';
import { resolveOrgId } from '../../lib/resolve';
import { FETCH_TREASURY_DATA } from '../../queries/treasury';
import { formatAddress } from '../../lib/encoding';
import * as output from '../../lib/output';

interface ViewArgs { org?: string; chain?: number; }

export const viewHandler = {
  builder: (yargs: Argv) => yargs,

  handler: async (argv: ArgumentsCamelCase<ViewArgs>) => {
    const spin = output.spinner('Fetching treasury data...');
    spin.start();

    try {
      const orgId = await resolveOrgId(argv.org, argv.chain);
      const result = await query<any>(FETCH_TREASURY_DATA, { orgId }, argv.chain);
      const org = result.organization;
      spin.stop();

      if (!org) { output.error('Organization not found'); process.exit(1); return; }

      if (output.isJsonMode()) {
        output.json({
          executor: org.executorContract ? { address: org.executorContract.id, isPaused: org.executorContract.isPaused } : null,
          token: org.participationToken ? { name: org.participationToken.name, symbol: org.participationToken.symbol, totalSupply: org.participationToken.totalSupply } : null,
          paymentManager: org.paymentManager ? {
            address: org.paymentManager.id,
            distributionCount: org.paymentManager.distributionCounter,
            distributions: org.paymentManager.distributions,
            recentPayments: org.paymentManager.payments?.slice(0, 10),
          } : null,
        });
      } else {
        console.log('');
        console.log('  Treasury Overview');
        console.log('  -----------------');
        if (org.participationToken) {
          const supply = ethers.utils.formatUnits(org.participationToken.totalSupply || '0', 18);
          console.log(`  Token:         ${org.participationToken.name} (${org.participationToken.symbol}), supply: ${supply}`);
        }
        if (org.executorContract) {
          console.log(`  Executor:      ${org.executorContract.id} (paused: ${org.executorContract.isPaused ? 'yes' : 'no'})`);
        }
        if (org.paymentManager) {
          const dists = org.paymentManager.distributions || [];
          const payments = org.paymentManager.payments || [];
          console.log(`  Distributions: ${dists.length}`);
          console.log(`  Payments:      ${payments.length}`);

          if (dists.length > 0) {
            console.log('');
            console.log('  Recent Distributions:');
            for (const d of dists.slice(0, 5)) {
              const total = ethers.utils.formatUnits(d.totalAmount || '0', 18);
              const claimed = ethers.utils.formatUnits(d.totalClaimed || '0', 18);
              console.log(`    #${d.distributionId} ${d.status} — ${claimed}/${total} claimed (${formatAddress(d.payoutToken || '')})`);
            }
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
