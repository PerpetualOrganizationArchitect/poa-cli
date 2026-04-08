import { resolveOrgModules, requireModule } from '../../lib/resolve';

export async function resolveTokenAddress(orgIdOrName: string | undefined, chainId?: number): Promise<{ orgId: string; tokenAddress: string }> {
  const modules = await resolveOrgModules(orgIdOrName, chainId);
  return {
    orgId: modules.orgId,
    tokenAddress: requireModule(modules, 'participationTokenAddress'),
  };
}
