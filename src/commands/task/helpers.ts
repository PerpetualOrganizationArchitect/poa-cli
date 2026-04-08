/**
 * Shared helpers for task commands.
 */

import { resolveOrgModules, requireModule } from '../../lib/resolve';
import type { OrgModules } from '../../lib/resolve';

export interface OrgContracts {
  orgId: string;
  taskManagerAddress: string;
  participationTokenAddress: string;
}

export async function resolveOrgContracts(orgIdOrName: string, chainId?: number): Promise<OrgContracts> {
  const modules = await resolveOrgModules(orgIdOrName, chainId);
  return {
    orgId: modules.orgId,
    taskManagerAddress: requireModule(modules, 'taskManagerAddress'),
    participationTokenAddress: modules.participationTokenAddress || '',
  };
}
