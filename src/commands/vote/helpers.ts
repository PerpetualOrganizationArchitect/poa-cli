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

/**
 * Resolve a user-supplied --proposal argument to a numeric proposal ID.
 *
 * Currently accepts only numeric IDs — the --proposal flag advertises
 * "Proposal ID (number) or fuzzy title query", but the fuzzy branch is
 * unimplemented. Non-numeric input throws with a clear instruction to
 * pass the numeric ID until the fuzzy path ships. See task #393 history
 * for why this helper was minimized rather than built out in-flight.
 *
 * The extra args (contractAddr, chainId, opts) are accepted so callers
 * in vote/cast.ts can keep their current signature; they're reserved
 * for when the fuzzy branch lands.
 */
export async function resolveProposalId(
  input: string,
  _contractAddr: string,
  _chainId?: number,
  _opts?: { preferActive?: boolean }
): Promise<number> {
  const trimmed = input.trim();
  const n = Number(trimmed);
  if (Number.isFinite(n) && Number.isInteger(n) && n >= 0 && String(n) === trimmed) {
    return n;
  }
  throw new Error(
    `Fuzzy proposal title resolution is not implemented yet (got '${input}'). Pass the numeric proposal ID.`
  );
}
