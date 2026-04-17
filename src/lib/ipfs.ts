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
 * Task #445: pin a directory of files to IPFS as a single wrapped CID.
 *
 * Posts each file under its relative path in a multipart form to The Graph
 * IPFS API with ?wrap-with-directory=true. The last NDJSON line in the
 * response (with empty Name) is the wrapping directory CID; intra-dir
 * paths resolve as `<gateway>/<directoryCID>/<relativePath>`.
 *
 * Used by the Argus public dashboard ship: pin agent/site/ → get one CID,
 * intra-page nav (mission.html, etc.) resolves under that same CID.
 *
 * KNOWN LIMITATION (HB#309 task #445 discovery): The Graph's IPFS endpoint
 * (DEFAULT_IPFS_API) hashes filenames on add — child links in the wrapped
 * directory are SHA256(originalName) hex strings, not the original names.
 * This means a static site with `<a href="mission.html">` links breaks
 * because the directory entry is named e.g. `709796f33057...` instead.
 * For static sites with intra-page navigation, point POP_IPFS_API_URL at
 * a different IPFS service (Pinata, web3.storage, or self-hosted Kubo
 * with proper UnixFS support) before calling pinDirectory.
 *
 * @param files - array of {path, content} where path is the relative path
 *                inside the resulting directory (e.g. "index.html",
 *                "assets/logo.svg"). Content is a Buffer.
 * @returns the wrapping directory CID (Qm...).
 */
export async function pinDirectory(files: Array<{ path: string; content: Buffer }>): Promise<string> {
  if (!files.length) {
    throw new Error('pinDirectory: empty file list');
  }
  const apiUrl = getIpfsApiUrl();

  const result = await withRetry(async () => {
    const formData = new FormData();
    for (const f of files) {
      // The Graph IPFS expects the filename to encode the relative path so
      // wrap-with-directory builds the correct tree. Files in subdirs use
      // the path with `/` separators; the API mirrors them on output.
      const blob = new Blob([f.content as any]);
      formData.append('file', blob, f.path);
    }

    const response = await fetch(`${apiUrl}/add?wrap-with-directory=true`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`IPFS dir upload failed: ${response.status} ${response.statusText}`);
    }

    // Response is NDJSON: one line per file plus the wrapping dir at the end.
    const text = await response.text();
    const lines = text.trim().split('\n').filter(Boolean);
    if (lines.length === 0) {
      throw new Error('IPFS dir upload returned empty response');
    }
    // The wrapping directory entry has Name === "" (empty); fall back to
    // the last entry if the empty-name entry is missing in some gateways.
    let wrappingHash: string | null = null;
    for (const line of lines) {
      const entry = JSON.parse(line);
      if (entry.Name === '' || entry.Name === undefined) {
        wrappingHash = entry.Hash;
        break;
      }
    }
    if (!wrappingHash) {
      // Fallback: take the last entry — in some implementations the
      // wrap-with-directory entry comes last with the dir's actual name.
      const lastEntry = JSON.parse(lines[lines.length - 1]);
      wrappingHash = lastEntry.Hash;
    }
    if (!wrappingHash) {
      throw new Error(`IPFS dir upload: no wrapping directory CID in response: ${text.slice(0, 500)}`);
    }
    return wrappingHash;
  });

  if (!result.startsWith('Qm') && !result.startsWith('bafy')) {
    throw new Error(`Unexpected IPFS directory CID format: ${result}`);
  }
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
