/**
 * Brain wire format v2 — delta-per-write IPLD envelopes with parent CID links.
 *
 * Per agent/artifacts/research/brain-wire-format-v2-design.md (task #455 + #431).
 * Hudson sign-off: HB#315 ("go ahead and start it now but yes it will also go
 * to the spin off repo"). Sprint 17 lands this in poa-cli; Sprint 18 extracts
 * to @unified-ai-brain/core.
 *
 * v2 fixes three structural costs of v1 snapshot-per-write:
 *   1. HB#334 disjoint-history bug class — Automerge.applyChanges is
 *      idempotent + order-independent + fail-loud, replacing Automerge.merge
 *      which silently drops content when docs lack a common root.
 *   2. Block bloat — KB-MB blocks per write become small deltas.
 *   3. No DAG walk — explicit parent CIDs let receivers BFS missing predecessors.
 *
 * v1 envelopes remain forever-readable. Wire-format negotiation via the
 * BrainHeadAnnouncement.envelopeV field (added separately in T4-followup) lets
 * mixed v1/v2 fleets coexist during cutover. POP_BRAIN_MAX_ENVELOPE_V env knob
 * controls per-daemon max version (default 1 in this release; bump to 2 after
 * fleet rollout).
 *
 * SCOPE OF THIS FILE: pure functions only — types, sign, verify, sig payload.
 * The encoder (delta extraction via Automerge.getChanges) and decoder (DAG walk
 * + applyChanges) live in src/lib/brain.ts as v2-branches of applyBrainChange
 * and fetchAndMergeRemoteHead. Migration tool ships separately as
 * src/commands/brain/migrate-to-v2.ts.
 */

import { ethers } from 'ethers';

export interface BrainChangeEnvelopeV2 {
  v: 2;
  author: string;          // 0x-prefixed lowercase Ethereum address
  timestamp: number;       // unix seconds, author wall-clock
  parentCids: string[];    // CIDs of immediate predecessors in this doc's DAG;
                           // empty array = first write after genesis.
                           // Stored sorted for canonical sig payload.
  changes: string;         // 0x-prefixed hex of Automerge.encodeChange(s) bytes
                           // (just the new local changes since last write,
                           // not the full doc state).
  priority: number;        // = max(parent.priority) + 1; genesis priority = 1.
  sig: string;             // 0x-prefixed ECDSA sig over canonicalMessageV2.
}

/**
 * Canonical sig payload for v2. NOT compatible with v1 — v2 envelopes signed
 * with a v1 payload would fail verification, and vice versa. The version
 * prefix prevents downgrade attacks.
 *
 * Format: pop-brain-change/v2|<author>|<timestamp>|<priority>|<parentCidsJoined>|<changes>
 *
 * Parent CIDs are sorted before joining so the same logical state always
 * produces the same signed payload regardless of how the caller ordered them.
 * Author + changes are lowercased for the same reason.
 */
export function canonicalMessageV2(
  author: string,
  timestamp: number,
  priority: number,
  parentCids: readonly string[],
  changesHex: string,
): string {
  return [
    'pop-brain-change/v2',
    author.toLowerCase(),
    String(timestamp),
    String(priority),
    [...parentCids].sort().join('|'),
    changesHex.toLowerCase(),
  ].join('|');
}

function bytesToHex(bytes: Uint8Array): string {
  return '0x' + Buffer.from(bytes).toString('hex');
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  return Uint8Array.from(Buffer.from(clean, 'hex'));
}

export interface SignBrainChangeV2Input {
  /** Automerge change bytes (the new local changes only, not the full state). */
  changeBytes: Uint8Array;
  /** Parent CID strings — the local frontier at write time. */
  parentCids: readonly string[];
  /** priority = max(parent.priority) + 1; genesis = 1. */
  priority: number;
  /** Optional override; defaults to POP_PRIVATE_KEY env. */
  privateKey?: string;
  /** Optional override timestamp (seconds); defaults to now. Useful for tests. */
  timestamp?: number;
}

/**
 * Sign a v2 envelope. Pure function modulo POP_PRIVATE_KEY env read +
 * Date.now() — both overridable for deterministic tests.
 */
export async function signBrainChangeV2(input: SignBrainChangeV2Input): Promise<BrainChangeEnvelopeV2> {
  const { changeBytes, parentCids, priority } = input;
  if (priority < 1 || !Number.isInteger(priority)) {
    throw new Error(`signBrainChangeV2: priority must be integer >= 1, got ${priority}`);
  }
  if (!Array.isArray(parentCids)) {
    throw new Error(`signBrainChangeV2: parentCids must be array, got ${typeof parentCids}`);
  }

  const key = input.privateKey || process.env.POP_PRIVATE_KEY;
  if (!key) {
    throw new Error('signBrainChangeV2: no private key (set POP_PRIVATE_KEY)');
  }

  const wallet = new ethers.Wallet(key);
  const author = wallet.address.toLowerCase();
  const timestamp = input.timestamp ?? Math.floor(Date.now() / 1000);
  const changesHex = bytesToHex(changeBytes);
  const sortedParentCids = [...parentCids].sort();

  const message = canonicalMessageV2(author, timestamp, priority, sortedParentCids, changesHex);
  const sig = await wallet.signMessage(message);

  return {
    v: 2,
    author,
    timestamp,
    parentCids: sortedParentCids,
    changes: changesHex,
    priority,
    sig,
  };
}

/**
 * Verify a v2 envelope's signature and return the recovered author address
 * (lowercased). Throws if the envelope is malformed, the version is wrong,
 * or the signature doesn't verify.
 *
 * Like v1 verifyBrainChange, this is AUTHENTICATION only — caller must run
 * isAllowedAuthor / authenticateAndAuthorize for AUTHORIZATION (whether the
 * verified author is allowed to write to this doc).
 */
export function verifyBrainChangeV2(envelope: BrainChangeEnvelopeV2): string {
  if (envelope.v !== 2) {
    throw new Error(`verifyBrainChangeV2: expected v=2, got v=${envelope.v}`);
  }
  if (!envelope.author || envelope.timestamp === undefined ||
      envelope.priority === undefined || !envelope.changes || !envelope.sig) {
    throw new Error('verifyBrainChangeV2: malformed envelope (missing required field)');
  }
  if (!Array.isArray(envelope.parentCids)) {
    throw new Error('verifyBrainChangeV2: parentCids must be array');
  }
  if (!Number.isInteger(envelope.priority) || envelope.priority < 1) {
    throw new Error(`verifyBrainChangeV2: priority must be integer >= 1, got ${envelope.priority}`);
  }

  // Re-sort parentCids defensively — the sig was over the sorted form.
  const sortedParentCids = [...envelope.parentCids].sort();
  const message = canonicalMessageV2(
    envelope.author,
    envelope.timestamp,
    envelope.priority,
    sortedParentCids,
    envelope.changes,
  );

  const recovered = ethers.utils.verifyMessage(message, envelope.sig).toLowerCase();
  if (recovered !== envelope.author.toLowerCase()) {
    throw new Error(
      `verifyBrainChangeV2: signature mismatch — expected ${envelope.author}, recovered ${recovered}`,
    );
  }
  return recovered;
}

/**
 * Extract the Automerge change bytes from a v2 envelope.
 * Does NOT verify the signature — caller must run verifyBrainChangeV2 first.
 */
export function unwrapChangeBytesV2(envelope: BrainChangeEnvelopeV2): Uint8Array {
  return hexToBytes(envelope.changes);
}

/**
 * Compute the priority of a new envelope from its parent envelopes.
 * Priority = max(parent.priority) + 1; if no parents (first write after
 * genesis), priority = 1. This mirrors go-ds-crdt's height-as-priority
 * pattern (crdt.go addDAGNode).
 */
export function computePriorityV2(parents: readonly { priority: number }[]): number {
  if (parents.length === 0) return 1;
  return Math.max(...parents.map(p => p.priority)) + 1;
}
