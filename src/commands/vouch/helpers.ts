import { resolveOrgModules, requireModule } from '../../lib/resolve';

export async function resolveEligibilityModule(orgIdOrName: string | undefined, chainId?: number): Promise<{ orgId: string; eligibilityModuleAddress: string }> {
  const modules = await resolveOrgModules(orgIdOrName, chainId);
  return {
    orgId: modules.orgId,
    eligibilityModuleAddress: requireModule(modules, 'eligibilityModuleAddress'),
  };
}
