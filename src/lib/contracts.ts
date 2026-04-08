/**
 * Contract Utilities
 * ABI loading and dynamic address resolution from subgraph.
 */

import { ethers } from 'ethers';
import path from 'path';
import fs from 'fs';

const abiCache: Map<string, any[]> = new Map();

/**
 * Load an ABI from the abi/ directory.
 */
export function loadAbi(name: string): any[] {
  let abi = abiCache.get(name);
  if (abi) return abi;

  const abiPath = path.join(__dirname, '..', 'abi', `${name}.json`);
  if (!fs.existsSync(abiPath)) {
    throw new Error(`ABI file not found: ${name}.json. Check that src/abi/${name}.json exists.`);
  }
  const content = fs.readFileSync(abiPath, 'utf-8');
  abi = JSON.parse(content) as any[];
  abiCache.set(name, abi);
  return abi!;
}

/**
 * Create a read-only contract instance.
 */
export function createReadContract(
  address: string,
  abiName: string,
  provider: ethers.providers.Provider
): ethers.Contract {
  return new ethers.Contract(address, loadAbi(abiName), provider);
}

/**
 * Create a writable contract instance (with signer).
 */
export function createWriteContract(
  address: string,
  abiName: string,
  signer: ethers.Signer
): ethers.Contract {
  return new ethers.Contract(address, loadAbi(abiName), signer);
}
