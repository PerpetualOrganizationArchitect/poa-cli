import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import { resolveNetworkConfig, getNetworkNameByChainId } from '../../config/networks';
import * as output from '../../lib/output';

export const showHandler = {
  builder: (yargs: Argv) => yargs,

  handler: async (argv: ArgumentsCamelCase<any>) => {
    const hasKey = !!(argv.privateKey || process.env.POP_PRIVATE_KEY);
    let address: string | undefined;
    if (hasKey) {
      try {
        const key = (argv.privateKey as string) || process.env.POP_PRIVATE_KEY!;
        address = new ethers.Wallet(key).address;
      } catch { /* invalid key */ }
    }

    const chainId = argv.chain || (process.env.POP_DEFAULT_CHAIN ? parseInt(process.env.POP_DEFAULT_CHAIN, 10) : undefined);
    const networkName = chainId ? getNetworkNameByChainId(chainId) : undefined;

    let rpc: string | undefined;
    let subgraph: string | undefined;
    try {
      if (chainId) {
        const config = resolveNetworkConfig(chainId);
        rpc = config.resolvedRpc;
        subgraph = config.resolvedSubgraph;
      }
    } catch { /* no chain set */ }

    const data = {
      wallet: address || '(not set)',
      chain: chainId ? `${networkName || 'unknown'} (${chainId})` : '(not set)',
      org: process.env.POP_DEFAULT_ORG || '(not set)',
      rpc: rpc ? rpc.substring(0, 60) + (rpc.length > 60 ? '...' : '') : '(not set)',
      subgraph: subgraph ? subgraph.substring(0, 60) + (subgraph.length > 60 ? '...' : '') : '(not set)',
      ipfsApi: process.env.POP_IPFS_API_URL || 'https://api.thegraph.com/ipfs/api/v0 (default)',
    };

    if (output.isJsonMode()) {
      output.json({
        wallet: address,
        hasPrivateKey: hasKey,
        chainId,
        networkName,
        org: process.env.POP_DEFAULT_ORG || null,
        rpc,
        subgraph,
        ipfsApi: process.env.POP_IPFS_API_URL || 'https://api.thegraph.com/ipfs/api/v0',
      });
    } else {
      console.log('');
      console.log('  POP CLI Configuration');
      console.log('  ---------------------');
      for (const [key, value] of Object.entries(data)) {
        console.log(`  ${key.padEnd(10)} ${value}`);
      }
      console.log('');
      if (!hasKey) output.warn('No private key set. Write transactions will fail. Set POP_PRIVATE_KEY in .env');
      if (!chainId) output.warn('No default chain set. Set POP_DEFAULT_CHAIN in .env or pass --chain');
    }
  },
};
