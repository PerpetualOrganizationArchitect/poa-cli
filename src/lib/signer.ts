/**
 * Signer / Wallet Management
 * Resolves a wallet from CLI flags or environment variables.
 */

import { ethers } from 'ethers';
import { resolveNetworkConfig } from '../config/networks';

export interface SignerContext {
  signer: ethers.Wallet;
  provider: ethers.providers.JsonRpcProvider;
  address: string;
  chainId: number;
}

/**
 * Create a connected signer for the target chain.
 * Priority: --private-key flag > POP_PRIVATE_KEY env > error
 */
export function createSigner(opts: {
  privateKey?: string;
  chainId?: number;
  rpcUrl?: string;
}): SignerContext {
  const key = opts.privateKey || process.env.POP_PRIVATE_KEY;
  if (!key) {
    throw new Error(
      'No private key provided. Set POP_PRIVATE_KEY in .env or pass --private-key flag.'
    );
  }

  const config = resolveNetworkConfig(opts.chainId);
  const rpcUrl = opts.rpcUrl || config.resolvedRpc;
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl, config.chainId);
  const signer = new ethers.Wallet(key, provider);

  return {
    signer,
    provider,
    address: signer.address,
    chainId: config.chainId,
  };
}

/**
 * Create a read-only provider (no signer needed).
 */
export function createProvider(opts: {
  chainId?: number;
  rpcUrl?: string;
}): ethers.providers.JsonRpcProvider {
  const config = resolveNetworkConfig(opts.chainId);
  const rpcUrl = opts.rpcUrl || config.resolvedRpc;
  return new ethers.providers.JsonRpcProvider(rpcUrl, config.chainId);
}
