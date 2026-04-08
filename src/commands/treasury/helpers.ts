import { resolveOrgModules, requireModule } from '../../lib/resolve';

export async function resolveTreasuryContracts(orgIdOrName: string | undefined, chainId?: number) {
  const modules = await resolveOrgModules(orgIdOrName, chainId);
  return {
    orgId: modules.orgId,
    paymentManagerAddress: requireModule(modules, 'paymentManagerAddress'),
    executorAddress: modules.executorAddress,
  };
}
