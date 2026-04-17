/**
 * User resolution helpers.
 *
 * resolveUserAddress accepts either a hex address (0x...) or a POP username
 * registered in the UniversalAccountRegistry, and returns the canonical
 * lowercase address. This lets commands accept --assignee sentinel_01 in
 * place of --assignee 0xC04C860454e73a9Ba524783aCbC7f7D6F5767eb6.
 *
 * Exact match only — no fuzzy. Users are a high-stakes identifier; fuzzy
 * matching risks assigning to the wrong person.
 */

import { queryAllChains } from './subgraph';

const HEX_ADDRESS = /^0x[a-fA-F0-9]{40}$/;

/**
 * Resolve a username to an address via the accounts subgraph.
 * Throws if the username is not registered.
 */
export async function resolveUsernameToAddress(username: string): Promise<string> {
  const query = `{ accounts(where: { username: "${username}" }, first: 1) { id username } }`;
  const results = await queryAllChains<{ accounts: Array<{ id: string; username: string }> }>(query, {});
  for (const r of results) {
    const account = r.data?.accounts?.[0];
    if (account) return account.id;
  }
  throw new Error(`Username "${username}" not found in UniversalAccountRegistry. Use a hex address or check spelling.`);
}

/**
 * Resolve a user identifier — either a hex address or a username — to a
 * canonical lowercase address. Throws if neither form can be resolved.
 */
export async function resolveUserAddress(identifier: string): Promise<string> {
  if (HEX_ADDRESS.test(identifier)) {
    return identifier.toLowerCase();
  }
  const addr = await resolveUsernameToAddress(identifier);
  return addr.toLowerCase();
}
