/**
 * Token configuration — decimals and metadata for known tokens.
 * Must match frontend token handling for correct amount encoding.
 */

export interface TokenInfo {
  symbol: string;
  decimals: number;
  address: string;
}

/** Participation Token is always 18 decimals */
export const PARTICIPATION_TOKEN_DECIMALS = 18;

/** Known tokens across all chains, keyed by lowercase address */
const KNOWN_TOKENS: Record<string, TokenInfo> = {
  // Arbitrum
  '0xaf88d065e77c8cc2239327c5edb3a432268e5831': { symbol: 'USDC', decimals: 6, address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' },
  // Gnosis
  '0xa555d5344f6fb6c65da19e403cb4c1ec4a1a5ee3': { symbol: 'BREAD', decimals: 18, address: '0xa555d5344f6FB6c65da19e403Cb4c1eC4a1a5Ee3' },
  '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83': { symbol: 'USDC', decimals: 6, address: '0xDDAfbb505ad214D7b80b1f830fcCc89B60fB7A83' },
  '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d': { symbol: 'WXDAI', decimals: 18, address: '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d' },
  // Sepolia
  '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238': { symbol: 'USDC', decimals: 6, address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' },
  // Base Sepolia
  '0x036cbd53842c5426634e7929541ec2318f3dcf7e': { symbol: 'USDC', decimals: 6, address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' },
};

export function getTokenByAddress(address: string): TokenInfo | null {
  return KNOWN_TOKENS[address.toLowerCase()] || null;
}

/**
 * Reverse lookup by symbol. Case-insensitive. Returns the first matching
 * token across all chains — if the same symbol exists on multiple chains
 * (e.g. USDC on Gnosis/Arbitrum/Sepolia), the caller should narrow by
 * chain using getTokenByAddress after resolving the chain-specific address
 * via another channel.
 */
export function getTokenBySymbol(symbol: string): TokenInfo | null {
  const want = symbol.toUpperCase();
  for (const t of Object.values(KNOWN_TOKENS)) {
    if (t.symbol.toUpperCase() === want) return t;
  }
  return null;
}

/**
 * Resolve a user-supplied token identifier to a checksummed address.
 * If input starts with 0x, returns it unchanged (caller's responsibility
 * to pre-validate). Otherwise treats it as a symbol and resolves via
 * getTokenBySymbol, throwing if unknown.
 */
export function resolveTokenAddress(input: string): string {
  if (input.startsWith('0x')) return input;
  const token = getTokenBySymbol(input);
  if (!token) {
    throw new Error(`Unknown token symbol: ${input}. Add it to config/tokens.ts or pass a 0x address.`);
  }
  return token.address;
}

export function getTokenDecimals(address: string): number {
  const token = getTokenByAddress(address);
  if (!token) {
    throw new Error(`Unknown bounty token: ${address}. Add it to config/tokens.ts or use a known token.`);
  }
  return token.decimals;
}
