import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import { query } from '../../lib/subgraph';
import { resolveOrgModules } from '../../lib/resolve';
import { createProvider } from '../../lib/signer';
import { createReadContract } from '../../lib/contracts';
import { resolveNetworkConfig } from '../../config/networks';
import * as output from '../../lib/output';

interface RolesArgs {
  org?: string;
  chain?: number;
  rpc?: string;
}

const FETCH_ROLES_AND_MEMBERS = `
  query FetchRolesAndMembers($id: Bytes!) {
    organization(id: $id) {
      roles(where: { isUserRole: true }) {
        id
        hatId
        name
        image
        canVote
        isUserRole
      }
      users {
        address
        participationTokenBalance
        membershipStatus
        currentHatIds
        account {
          username
        }
      }
      eligibilityModule {
        id
      }
    }
  }
`;

export const rolesHandler = {
  builder: (yargs: Argv) => yargs,

  handler: async (argv: ArgumentsCamelCase<RolesArgs>) => {
    const spin = output.spinner('Fetching roles...');
    spin.start();

    try {
      const modules = await resolveOrgModules(argv.org, argv.chain);
      const result = await query<any>(FETCH_ROLES_AND_MEMBERS, { id: modules.orgId }, argv.chain);
      const org = result.organization;

      if (!org) throw new Error('Organization not found');

      const roles = org.roles || [];
      const users = org.users || [];
      const eligibilityAddr = org.eligibilityModule?.id;

      // Try to get vouch config for each role from the contract
      let vouchConfigs: Record<string, { enabled: boolean; quorum: string }> = {};
      if (eligibilityAddr) {
        try {
          const provider = createProvider({ chainId: argv.chain, rpcUrl: argv.rpc as string });
          const contract = createReadContract(eligibilityAddr, 'EligibilityModuleNew', provider);

          const configs = await Promise.all(
            roles.map(async (r: any) => {
              try {
                const [isEnabled, config] = await Promise.all([
                  contract.isVouchingEnabled(r.hatId),
                  contract.vouchConfigs(r.hatId),
                ]);
                return {
                  hatId: r.hatId,
                  enabled: isEnabled,
                  quorum: config?.quorum ? ethers.BigNumber.from(config.quorum).toString() : '0',
                };
              } catch {
                return { hatId: r.hatId, enabled: false, quorum: '?' };
              }
            })
          );

          for (const c of configs) {
            vouchConfigs[c.hatId] = { enabled: c.enabled, quorum: c.quorum };
          }
        } catch {
          // Eligibility module query failed — continue without vouch data
        }
      }

      // Map wearers to roles
      const roleData = roles.map((r: any) => {
        const wearers = users
          .filter((u: any) => u.currentHatIds?.includes(r.hatId) && u.membershipStatus === 'Active')
          .map((u: any) => ({
            address: u.address,
            username: u.account?.username || null,
            pt: ethers.utils.formatEther(u.participationTokenBalance || '0'),
          }));

        const vc = vouchConfigs[r.hatId];

        return {
          hatId: r.hatId,
          name: r.name || 'Unnamed',
          canVote: r.canVote,
          vouchRequired: vc?.enabled || false,
          vouchQuorum: vc?.quorum || '?',
          wearers: wearers.length,
          wearerList: wearers,
        };
      });

      spin.stop();

      if (output.isJsonMode()) {
        output.json(roleData);
      } else {
        console.log('');
        console.log('  Org Roles');
        console.log('  ─────────');
        for (const r of roleData) {
          console.log('');
          console.log(`  ${r.name}`);
          console.log(`    Hat ID:    ${r.hatId}`);
          console.log(`    Can vote:  ${r.canVote ? 'yes' : 'no'}`);
          console.log(`    Vouching:  ${r.vouchRequired ? `yes (quorum: ${r.vouchQuorum})` : 'no'}`);
          console.log(`    Wearers:   ${r.wearers}`);
          for (const w of r.wearerList) {
            const label = w.username || w.address.slice(0, 12) + '...';
            console.log(`      - ${label} (${w.pt} PT)`);
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
