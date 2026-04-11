import type { Argv, ArgumentsCamelCase } from 'yargs';
import { createSigner } from '../../lib/signer';
import { createWriteContract } from '../../lib/contracts';
import { executeTx } from '../../lib/tx';
import { requireAddress } from '../../lib/validation';
import * as output from '../../lib/output';
import { resolveEligibilityModule } from './helpers';
import { resolveOrgModules } from '../../lib/resolve';

interface ForArgs {
  org?: string;
  address: string;
  hat?: string;
  role?: string;
  chain?: number;
  rpc?: string;
  'private-key'?: string;
  'dry-run'?: boolean;
}

/**
 * Resolve a role name to its hat ID by querying the org's roles.
 * Throws if the role name doesn't match or matches multiple roles.
 */
async function resolveRoleToHatId(orgIdOrName: string, roleName: string, chainId?: number): Promise<string> {
  const { queryAllChains } = require('../../lib/subgraph');
  const modules = await resolveOrgModules(orgIdOrName, chainId);
  const orgId = modules.orgId;

  const query = `{
    organization(id: "${orgId}") {
      roles(where: { isUserRole: true }) { hatId name }
    }
  }`;

  const results = await queryAllChains(query, {});
  const matches: Array<{ hatId: string; name: string }> = [];

  for (const r of results) {
    const roles = r.data?.organization?.roles || [];
    for (const role of roles) {
      if (role.name && role.name.toLowerCase() === roleName.toLowerCase()) {
        matches.push({ hatId: role.hatId, name: role.name });
      }
    }
  }

  if (matches.length === 0) {
    // Try partial match
    for (const r of results) {
      const roles = r.data?.organization?.roles || [];
      for (const role of roles) {
        if (role.name && role.name.toLowerCase().includes(roleName.toLowerCase())) {
          matches.push({ hatId: role.hatId, name: role.name });
        }
      }
    }
  }

  if (matches.length === 0) {
    throw new Error(`No role named "${roleName}" found. Use pop org roles to list available roles.`);
  }
  if (matches.length > 1) {
    const names = matches.map(m => `${m.name} (${m.hatId})`).join(', ');
    throw new Error(`Multiple roles match "${roleName}": ${names}. Use --hat with the specific hat ID.`);
  }

  return matches[0].hatId;
}

export const forHandler = {
  builder: (yargs: Argv) => yargs
    .option('address', { type: 'string', demandOption: true, describe: 'Address of the user to vouch for' })
    .option('hat', { type: 'string', describe: 'Hat ID of the role' })
    .option('role', { type: 'string', describe: 'Role name (e.g. MEMBER, Agent) — resolves to hat ID' })
    .check((argv) => {
      if (!argv.hat && !argv.role) {
        throw new Error('Either --hat or --role is required');
      }
      return true;
    }),

  handler: async (argv: ArgumentsCamelCase<ForArgs>) => {
    const wearer = requireAddress(argv.address, 'address');

    // Resolve hat ID from --role if provided
    let hatId = argv.hat as string;
    if (!hatId && argv.role) {
      const resolved = await resolveRoleToHatId(argv.org as string, argv.role as string, argv.chain);
      hatId = resolved;
      console.log(`  Resolved role "${argv.role}" → hat ${hatId.slice(0, 20)}...`);
    }

    const spin = output.spinner('Vouching...');
    spin.start();

    try {
      const { eligibilityModuleAddress } = await resolveEligibilityModule(argv.org, argv.chain);
      const { signer } = createSigner({ privateKey: argv.privateKey as string, chainId: argv.chain, rpcUrl: argv.rpc as string });

      const contract = createWriteContract(eligibilityModuleAddress, 'EligibilityModuleNew', signer);
      const result = await executeTx(contract, 'vouchFor', [wearer, hatId], { dryRun: argv.dryRun });
      spin.stop();

      if (result.success) {
        output.success(`Vouched for ${wearer} on hat ${hatId}`, { txHash: result.txHash, explorerUrl: result.explorerUrl });
      } else {
        output.error('Vouch failed', { error: result.error, errorCode: result.errorCode });
        process.exit(2);
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
