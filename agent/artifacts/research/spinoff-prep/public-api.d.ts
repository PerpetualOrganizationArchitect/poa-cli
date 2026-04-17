/**
 * @unified-ai-brain/core — public API surface (draft spec)
 *
 * Authored for task #462 (sentinel_01 HB#541) as Sprint 18 spinoff prep.
 * TypeScript declarations only — no implementation. JSDoc indicates
 * stability, 3 integration tiers, and companions.
 *
 * Reference Argus source: src/lib/brain.ts + brain-signing.ts + brain-schemas.ts.
 * This spec COLLAPSES that surface into three tiers a fleet agent can pick from:
 *
 *   Tier 1 — Just CRDT writes     (pure function, no networking)
 *   Tier 2 — Local daemon         (adds libp2p/gossipsub/bitswap)
 *   Tier 3 — Governance primitives (adds brainstorm/retro/proposal flows)
 *
 * See companion README.md for per-tier integration guides + stability guarantees.
 */

declare module '@unified-ai-brain/core' {

  // ─────────────────────────────────────────────────────────────
  // Tier 1 — Pure CRDT (no I/O, no network)
  // ─────────────────────────────────────────────────────────────

  /** A CID string — IPFS-style content address. */
  export type CID = string;

  /** Base58 libp2p peer ID. */
  export type PeerId = string;

  /** Ethereum/EVM-style EOA address (0x-prefixed, 20 bytes hex). */
  export type Address = string;

  /**
   * Signed envelope wrapping an Automerge document snapshot (v1) or
   * delta chain (v2). See BrainChangeV2 for v2 semantics.
   */
  export interface BrainChangeEnvelope {
    readonly v: 1 | 2;
    readonly author: Address;
    readonly timestamp: number;          // unix seconds
    readonly automerge?: string;         // v1: hex-encoded Automerge.save() bytes
    readonly changes?: string[];         // v2: hex-encoded delta changes
    readonly parentCids?: CID[];         // v2: predecessor envelope CIDs
    readonly priority?: number;          // v2: max(parent.priority)+1
    readonly sig: string;                // 0x-prefixed ECDSA sig over canonical payload
  }

  /**
   * v2 wire format for delta-per-write IPLD blocks with explicit parent
   * CID links. Replaces v1's snapshot-per-write. Idempotent + order-
   * independent + fail-loud via Automerge.applyChanges.
   */
  export interface BrainChangeV2 extends BrainChangeEnvelope {
    readonly v: 2;
    readonly changes: string[];
    readonly parentCids: CID[];
    readonly priority: number;
  }

  /** Open a brain doc from local state. Returns opaque Automerge doc handle. */
  export function openBrainDoc<T = any>(docId: string, opts?: OpenDocOpts): Promise<{
    readonly doc: T;
    readonly headCid: CID | null;
  }>;

  export interface OpenDocOpts {
    readonly allowInvalidShape?: boolean;
    readonly store?: HeadsManifestStore;
  }

  /**
   * Apply a change function to a brain doc. Returns new head CID + doc.
   * Internally: loads doc, mutates via changeFn (Automerge-style), signs envelope,
   * writes block, updates heads manifest, optionally broadcasts via daemon.
   */
  export function applyBrainChange<T = any>(
    docId: string,
    changeFn: (doc: T) => void,
    opts?: ApplyChangeOpts,
  ): Promise<{ headCid: CID; doc: T; author: Address }>;

  export interface ApplyChangeOpts {
    readonly allowInvalidShape?: boolean;
    readonly envelopeVersion?: 1 | 2;  // defaults to getMaxEnvelopeVersion()
  }

  /** Sign a v1 envelope wrapping raw Automerge.save() bytes. */
  export function signBrainChange(automergeBytes: Uint8Array, key?: PrivateKey): Promise<BrainChangeEnvelope>;

  /** Sign a v2 envelope wrapping delta changes + parent CIDs. */
  export function signBrainChangeV2(
    changes: string[],
    parentCids: CID[],
    priority: number,
    key?: PrivateKey,
  ): Promise<BrainChangeV2>;

  /** Verify envelope signature. Returns recovered author address on success. Throws on bad sig. */
  export function verifyBrainChange(envelope: BrainChangeEnvelope): Address;
  export function verifyBrainChangeV2(envelope: BrainChangeV2): Address;

  /** Pack/unpack change arrays for wire transport. Preserves byte identity. */
  export function packChanges(changes: Uint8Array[]): string[];
  export function unpackChanges(hex: string[]): Uint8Array[];

  /** Unwrap Automerge bytes from an envelope (handles both v1 and v2 snapshot). */
  export function unwrapAutomergeBytes(envelope: BrainChangeEnvelope): Uint8Array;

  /** Currently-enforced envelope version ceiling. Set via POP_BRAIN_MAX_ENVELOPE_V. */
  export function getMaxEnvelopeVersion(): 1 | 2;

  // ─────────────────────────────────────────────────────────────
  // Tier 1 — Storage adapter (pluggable)
  // ─────────────────────────────────────────────────────────────

  /**
   * Pluggable storage for the heads manifest. The default impl is filesystem
   * ($HOME/.brain/doc-heads-v2.json), but fleets can plug IndexedDB, S3, or
   * in-memory. MUST be atomic: readers should never see a truncated file.
   */
  export interface HeadsManifestStore {
    load(): Promise<Record<string, CID[]>>;
    save(manifest: Record<string, CID[]>): Promise<void>;
  }

  /** Default filesystem store reading from POP_BRAIN_HOME. */
  export function createFilesystemStore(brainHome?: string): HeadsManifestStore;

  /** In-memory store useful for tests. */
  export function createMemoryStore(): HeadsManifestStore;

  // ─────────────────────────────────────────────────────────────
  // Tier 1 — Membership / auth adapter (pluggable)
  // ─────────────────────────────────────────────────────────────

  /**
   * Pluggable membership check. Argus's default checks the org's Hats
   * contract on-chain + a static allowlist fallback. Non-POP fleets can
   * plug arbitrary auth: Discord role, passkey, ENS ownership, etc.
   */
  export interface MembershipProvider {
    isAllowed(author: Address): Promise<boolean>;
    list?(): Promise<Address[]>;
    subscribeChanges?(onChange: () => void): () => void;
  }

  /** Static allowlist provider — agents hard-coded at startup. */
  export function createStaticAllowlist(addresses: Address[]): MembershipProvider;

  // ─────────────────────────────────────────────────────────────
  // Tier 2 — Local daemon (libp2p + gossipsub + bitswap)
  // ─────────────────────────────────────────────────────────────

  /**
   * Boot a persistent daemon that subscribes to doc topics, auto-dials
   * registered peers, rebroadcasts heads for anti-entropy, repairs dirty
   * blocks, and broadcasts local writes. IPC-accessible via unix socket.
   */
  export function startDaemon(opts?: DaemonOpts): Promise<DaemonHandle>;

  export interface DaemonOpts {
    readonly brainHome?: string;           // default: $POP_BRAIN_HOME or ~/.brain
    readonly listenPort?: number;          // default: derived from peer key hash
    readonly peerAddrs?: string[];         // bootstrap peer multiaddrs
    readonly rebroadcastMs?: number;       // default: 60_000 ± jitter
    readonly repairMs?: number;            // default: 3_600_000
    readonly peersRefreshMs?: number;      // default: 300_000 (pop.brain.peers publish)
    readonly username?: string;            // optional operator tag for peer registry
  }

  export interface DaemonHandle {
    readonly peerId: PeerId;
    readonly pid: number;
    status(): Promise<DaemonStatus>;
    stop(): Promise<void>;
  }

  export interface DaemonStatus {
    readonly running: boolean;
    readonly peerId: PeerId;
    readonly uptimeSec: number;
    readonly connections: number;
    readonly knownPeers: number;
    readonly subscribedTopics: string[];
    readonly rebroadcastCount: number;
    readonly incomingAnnouncements: number;
    readonly incomingMerges: number;
    readonly incomingRejects: number;
  }

  /**
   * Head announcement payload. v2-aware receivers read `cids[]` (full frontier);
   * pre-v2 receivers read `cid` (= `cids[0]` by invariant). Receivers fetch
   * any unknown CID via bitswap and merge via fetchAndMergeRemoteHead.
   */
  export interface BrainHeadAnnouncement {
    readonly v: 1;
    readonly docId: string;
    readonly cid: CID;                     // back-compat, always cids[0]
    readonly cids?: CID[];                 // full frontier (T4, task #432)
    readonly envelopeV?: 1 | 2;            // wire-format negotiation (T3, task #431)
    readonly author: Address;              // informational only, not trusted
    readonly timestamp: number;
  }

  /** Subscribe to a doc's gossipsub topic. Returns unsubscribe function. */
  export function subscribeBrainTopic(
    docId: string,
    onAnnouncement: (ann: BrainHeadAnnouncement, from: PeerId) => void,
  ): Promise<() => void>;

  /** Publish a head announcement. Defaults cids = [cid]. */
  export function publishBrainHead(
    docId: string,
    cid: CID,
    author: Address,
    cids?: CID[],
  ): Promise<void>;

  /**
   * Fetch + merge a remote head into local state. Does bitswap fetch,
   * envelope verify, allowlist check, Automerge.applyChanges (v2) or
   * Automerge.merge (v1 back-compat), persists, updates frontier.
   * Idempotent — safe to call with already-known CIDs.
   */
  export function fetchAndMergeRemoteHead(
    docId: string,
    remoteCid: CID,
  ): Promise<BrainSyncResult>;

  export type BrainSyncResult =
    | { action: 'adopt' | 'merge'; headCid: CID; reason: string }
    | { action: 'skip' | 'reject'; reason: string };

  // ─────────────────────────────────────────────────────────────
  // Tier 3 — Governance primitives (opt-in)
  // ─────────────────────────────────────────────────────────────

  /**
   * Cross-agent brainstorm — forward-looking ideation surface. Agents
   * propose ideas; peers vote support/oppose/explore; one agent closes
   * and promotes to an on-chain proposal. See Argus's pop.brain.brainstorms.
   */
  export interface Brainstorm {
    readonly id: string;
    readonly title: string;
    readonly prompt: string;
    readonly author: Address;
    readonly openedAt: number;
    readonly status: 'open' | 'voting' | 'closed';
    readonly ideas: BrainstormIdea[];
    readonly discussion: BrainstormMessage[];
    readonly closedAt?: number;
    readonly closedBy?: Address;
    readonly closedReason?: string;
  }

  export interface BrainstormIdea {
    readonly id: string;
    readonly body: string;
    readonly author: Address;
    readonly timestamp: number;
    readonly votes: Record<Address, 'support' | 'oppose' | 'explore'>;
  }

  export interface BrainstormMessage {
    readonly author: Address;
    readonly timestamp: number;
    readonly message: string;
  }

  export function brainstormStart(title: string, prompt: string, opts?: { id?: string }): Promise<string>;
  export function brainstormRespond(
    id: string,
    resp: { message?: string; addIdea?: string; votes?: Record<string, 'support' | 'oppose' | 'explore'> },
  ): Promise<void>;
  export function brainstormClose(id: string, reason: string): Promise<void>;
  export function brainstormPromote(id: string, ideaId: string, projectEntry: ProjectEntryPartial): Promise<string>;

  /** Partial — fleet can extend. Covers {id, name, brief, stage}. */
  export interface ProjectEntryPartial {
    readonly id: string;
    readonly name: string;
    readonly brief: string;
    readonly stage?: 'propose' | 'discuss' | 'plan' | 'execute' | 'review' | 'ship';
  }

  // ─────────────────────────────────────────────────────────────
  // Private key handling (intentionally minimal surface)
  // ─────────────────────────────────────────────────────────────

  /** Fleet-defined private key source. Default: read POP_PRIVATE_KEY from env. */
  export interface PrivateKey {
    address(): Address;
    sign(digest: Uint8Array): Promise<Uint8Array>;
  }

  /** Factory for the default env-var-backed key. */
  export function envPrivateKey(envVar?: string): PrivateKey;
}
