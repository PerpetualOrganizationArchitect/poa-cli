import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import { query } from '../../lib/subgraph';
import { resolveOrgModules, requireModule } from '../../lib/resolve';
import { FETCH_ALL_ROLE_APPLICATIONS, FETCH_USER_ROLE_APPLICATIONS } from '../../queries/role';
import { formatAddress } from '../../lib/encoding';
import * as output from '../../lib/output';

interface ApplicationsArgs {
  org?: string;
  mine?: boolean;
  hat?: string;
  chain?: number;
  'private-key'?: string;
}

export const applicationsHandler = {
  builder: (yargs: Argv) => yargs
    .option('mine', { type: 'boolean', describe: 'Show only my applications' })
    .option('hat', { type: 'string', describe: 'Filter by hat ID' }),

  handler: async (argv: ArgumentsCamelCase<ApplicationsArgs>) => {
    const spin = output.spinner('Fetching role applications...');
    spin.start();

    try {
      const modules = await resolveOrgModules(argv.org, argv.chain);
      const eligibilityAddr = requireModule(modules, 'eligibilityModuleAddress');

      let applications: any[];

      if (argv.mine) {
        const key = argv.privateKey as string || process.env.POP_PRIVATE_KEY;
        if (!key) throw new Error('--mine requires a private key');
        const address = new ethers.Wallet(key).address.toLowerCase();

        const result = await query<any>(
          FETCH_USER_ROLE_APPLICATIONS,
          { eligibilityModuleId: eligibilityAddr, applicant: address },
          argv.chain
        );
        applications = result.roleApplications || [];
      } else {
        const result = await query<any>(
          FETCH_ALL_ROLE_APPLICATIONS,
          { eligibilityModuleId: eligibilityAddr },
          argv.chain
        );
        applications = result.roleApplications || [];
      }

      if (argv.hat) {
        applications = applications.filter((a: any) => a.hatId === argv.hat);
      }

      spin.stop();

      if (applications.length === 0) {
        output.info('No role applications found');
        return;
      }

      const rows = applications.map((a: any) => [
        a.hatId,
        a.applicantUsername || formatAddress(a.applicant),
        a.active ? 'Active' : 'Inactive',
        a.appliedAt ? new Date(parseInt(a.appliedAt) * 1000).toLocaleDateString() : '',
      ]);

      output.table(['Hat', 'Applicant', 'Status', 'Applied'], rows);
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
