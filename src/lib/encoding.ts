/**
 * Encoding Utilities
 * Direct port of frontend encoding.js for byte-identical behavior.
 * Uses ethers v5 + bs58 v6 to match frontend exactly.
 */

import { ethers } from 'ethers';
import bs58 from 'bs58';

export function stringToBytes(str: string): Uint8Array {
  return ethers.utils.toUtf8Bytes(str);
}

export function bytesToString(bytes: Uint8Array): string {
  return ethers.utils.toUtf8String(bytes);
}

export function stringToBytes32(str: string): string {
  if (!str) return ethers.constants.HashZero;
  return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(str));
}

/**
 * Encode IPFS CIDv0 (Qm...) to bytes32.
 * CIDv0 = base58(0x1220 + 32-byte-sha256-hash)
 * We store just the 32-byte hash portion.
 */
export function ipfsCidToBytes32(cid: string): string {
  if (!cid || cid === '') {
    return ethers.constants.HashZero;
  }

  if (!cid.startsWith('Qm')) {
    if (cid.startsWith('0x') && cid.length === 66) {
      return cid;
    }
    return stringToBytes32(cid);
  }

  try {
    const decoded = bs58.decode(cid);
    if (decoded.length !== 34) {
      console.error(`Invalid CIDv0 length: expected 34 bytes, got ${decoded.length}`);
      return ethers.constants.HashZero;
    }
    const hashBytes = decoded.slice(2);
    return ethers.utils.hexlify(hashBytes);
  } catch (error) {
    console.error('Failed to encode IPFS CID to bytes32:', error);
    return ethers.constants.HashZero;
  }
}

/**
 * Decode bytes32 back to IPFS CIDv0.
 */
export function bytes32ToIpfsCid(bytes32Hash: string): string | null {
  if (!bytes32Hash || bytes32Hash === ethers.constants.HashZero) return null;

  try {
    const hashBytes = ethers.utils.arrayify(bytes32Hash);
    const withPrefix = new Uint8Array([0x12, 0x20, ...hashBytes]);
    return bs58.encode(withPrefix);
  } catch (error) {
    console.warn('Failed to decode bytes32 to IPFS CID:', error);
    return null;
  }
}

/**
 * Parse a task ID from subgraph format.
 * Subgraph returns IDs like "contractAddress-taskId", contract expects numeric taskId.
 */
export function parseTaskId(taskId: string | number): string {
  const taskIdStr = taskId.toString();
  const result = taskIdStr.includes('-') ? taskIdStr.split('-')[1] : taskIdStr;
  if (!result) {
    throw new Error(`Invalid task ID format: "${taskId}"`);
  }
  return result;
}

export function parseModuleId(moduleId: string | number): string {
  const moduleIdStr = moduleId.toString();
  const result = moduleIdStr.includes('-') ? moduleIdStr.split('-')[1] : moduleIdStr;
  if (!result) {
    throw new Error(`Invalid module ID format: "${moduleId}"`);
  }
  return result;
}

/**
 * Parse a project ID from subgraph format.
 * Subgraph: "{contractAddress}-{projectId}" where projectId is bytes32 hex.
 */
export function parseProjectId(projectId: string): string {
  if (!projectId) {
    return ethers.constants.HashZero;
  }

  if (projectId.startsWith('0x') && projectId.length === 66) {
    return projectId;
  }

  const subgraphPattern = /^0x[a-fA-F0-9]{40}-(.+)$/;
  const match = projectId.match(subgraphPattern);

  if (match) {
    const extractedId = match[1];
    if (extractedId.startsWith('0x') && extractedId.length === 66) {
      return extractedId;
    }
    if (/^[a-fA-F0-9]+$/.test(extractedId)) {
      return ethers.utils.hexZeroPad('0x' + extractedId, 32);
    }
  }

  return stringToBytes32(projectId);
}

export function formatAddress(address: string, chars = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function isValidAddress(address: string): boolean {
  return ethers.utils.isAddress(address);
}

export function toChecksumAddress(address: string): string {
  return ethers.utils.getAddress(address);
}
