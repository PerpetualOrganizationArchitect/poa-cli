/**
 * Shared label alias map for contract-name matching.
 *
 * Some contracts identify on-chain with a token symbol (GTC for Gitcoin)
 * or a descriptive technical term (Vote-escrowed CRV for Curve's veCRV)
 * that doesn't literally contain the project's name. This map says
 * "if the expected label is X, consider these on-chain strings to be
 * an acceptable match."
 *
 * Keys are lower-case filename / project labels; values are lower-case
 * tokens expected to appear in the on-chain `name()` return value.
 *
 * Populated from HB#386's corpus identity sweep first-run false positives
 * (task #391) and used by:
 *   - src/commands/org/probe-access.ts → matchContractName (task #395, HB)
 *   - agent/scripts/audit-corpus-identity-sweep.mjs (filename-fuzzy mode)
 *
 * Additions should be justified with a short comment explaining why the
 * alias is correct (e.g. "Curve's token is CRV; the VotingEscrow contract
 * identifies as 'Vote-escrowed CRV'").
 */
export const LABEL_ALIASES: Record<string, readonly string[]> = {
  // Gitcoin's token is GTC; Gitcoin's GovernorAlpha contract identifies
  // as "GTC Governor Alpha" on-chain. HB#386 sweep surfaced this.
  gitcoin: ['gtc'],
  // Curve's VotingEscrow contract identifies as "Vote-escrowed CRV" on-chain.
  // The label "curve votingescrow" → actual "Vote-escrowed CRV" is correct
  // but requires the CRV alias (Curve's token). HB#386 sweep.
  curve: ['crv', 'vote-escrowed'],
};

/**
 * Return the full list of strings considered an acceptable match for the
 * given label: the label itself, plus any aliases registered under any of
 * its lower-cased whitespace-separated words. Case-insensitive.
 *
 * Example:
 *   expandAliases("Curve VotingEscrow") → ["curve votingescrow", "crv", "vote-escrowed"]
 */
export function expandAliases(label: string): string[] {
  const lowered = label.toLowerCase();
  const out: string[] = [lowered];
  for (const word of lowered.split(/\s+/).filter(Boolean)) {
    const aliases = LABEL_ALIASES[word];
    if (aliases) out.push(...aliases);
  }
  return out;
}
