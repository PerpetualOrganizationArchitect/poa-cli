/**
 * Shared helpers for education commands.
 */

import { resolveOrgModules, requireModule } from '../../lib/resolve';

export interface EducationContracts {
  orgId: string;
  educationHubAddress: string;
}

export async function resolveEducationContracts(orgIdOrName: string, chainId?: number): Promise<EducationContracts> {
  const modules = await resolveOrgModules(orgIdOrName, chainId);
  return {
    orgId: modules.orgId,
    educationHubAddress: requireModule(modules, 'educationHubAddress'),
  };
}
