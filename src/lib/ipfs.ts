/**
 * IPFS Client
 * Pin and fetch via The Graph's IPFS endpoint.
 * Uses direct HTTP (FormData) to match frontend behavior.
 */

import { bytes32ToIpfsCid, ipfsCidToBytes32 } from './encoding';

const DEFAULT_IPFS_API = 'https://api.thegraph.com/ipfs/api/v0';
const DEFAULT_IPFS_GATEWAY = 'https://ipfs.io/ipfs/';
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

function getIpfsApiUrl(): string {
  return process.env.POP_IPFS_API_URL || DEFAULT_IPFS_API;
}

function getIpfsGatewayUrl(): string {
  return process.env.POP_IPFS_GATEWAY_URL || DEFAULT_IPFS_GATEWAY;
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = MAX_RETRIES, baseDelay = BASE_DELAY_MS): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Pin JSON content to IPFS via The Graph's endpoint.
 * Uses FormData POST to match frontend behavior exactly.
 * Returns CIDv0 (Qm...) string.
 */
export async function pinJson(content: string): Promise<string> {
  const apiUrl = getIpfsApiUrl();

  const result = await withRetry(async () => {
    // Node 18+ has FormData and Blob globally
    const formData = new FormData();
    formData.append('file', new Blob([content], { type: 'application/octet-stream' }));

    const response = await fetch(`${apiUrl}/add`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`IPFS upload failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.Hash as string;
  });

  if (!result.startsWith('Qm')) {
    throw new Error(`Unexpected IPFS CID format: ${result}`);
  }

  return result;
}

/**
 * Pin a file (binary) to IPFS.
 */
export async function pinFile(content: Buffer): Promise<string> {
  const apiUrl = getIpfsApiUrl();

  const result = await withRetry(async () => {
    const formData = new FormData();
    formData.append('file', new Blob([content] as any));

    const response = await fetch(`${apiUrl}/add`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`IPFS upload failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.Hash as string;
  });

  return result;
}

/**
 * Fetch JSON content from IPFS.
 * Accepts CIDv0 (Qm...) or bytes32 (0x...) hash.
 */
export async function fetchJson<T = any>(hashOrCid: string): Promise<T | null> {
  if (!hashOrCid) return null;

  // Handle zero hashes
  if (hashOrCid.startsWith('0x') && /^0x0+$/.test(hashOrCid)) return null;

  // Convert bytes32 to CID if needed
  let cid = hashOrCid;
  if (hashOrCid.startsWith('0x')) {
    const converted = bytes32ToIpfsCid(hashOrCid);
    if (!converted) return null;
    cid = converted;
  }

  const gatewayUrl = getIpfsGatewayUrl();

  const result = await withRetry(async () => {
    const response = await fetch(`${gatewayUrl}${cid}`);
    if (!response.ok) {
      throw new Error(`IPFS fetch failed: ${response.status} ${response.statusText}`);
    }
    const text = await response.text();
    if (text.length > 10 * 1024 * 1024) {
      throw new Error('IPFS response too large (>10MB)');
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`Invalid JSON from IPFS (CID: ${cid}). Response starts with: ${text.slice(0, 100)}`);
    }
  });

  return result;
}

/** Re-export encoding helpers for convenience */
export { bytes32ToIpfsCid, ipfsCidToBytes32 };
