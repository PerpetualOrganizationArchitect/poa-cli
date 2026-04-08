/**
 * Shared helpers for voting commands.
 */

import { resolveOrgModules } from '../../lib/resolve';

export interface VotingContracts {
  orgId: string;
  hybridVotingAddress: string | null;
  ddVotingAddress: string | null;
}

export async function resolveVotingContracts(orgIdOrName: string, chainId?: number): Promise<VotingContracts> {
  const modules = await resolveOrgModules(orgIdOrName, chainId);
  return {
    orgId: modules.orgId,
    hybridVotingAddress: modules.hybridVotingAddress,
    ddVotingAddress: modules.ddVotingAddress,
  };
}
