/**
 * Unified brain write dispatcher (HB#324 principal-engineer ship-2).
 *
 * ## Why this module exists
 *
 * Before this module, every brain write command (append-lesson, edit-lesson,
 * remove-lesson, new-project, advance-stage, remove-project, …) called
 * `applyBrainChange` directly with a closure. That works fine in-process but
 * cannot be routed through IPC to a running daemon — closures don't serialize.
 *
 * The brain daemon needs to be the single owner of libp2p/gossipsub when it's
 * running (HB#312 dogfood wedge proved sequential agent sessions never overlap
 * in wall-clock time, so a short-lived in-process libp2p can't reliably
 * deliver a gossipsub announcement before exiting). For the daemon to be
 * useful, every write has to route through it. For the daemon to be usable,
 * the CLI commands need a transparent fallback when no daemon is running.
 *
 * The solution is to turn every brain write into a pure-data operation
 * descriptor (`BrainOp`) and have two execution paths that share zero
 * business logic:
 *
 *   `dispatchOp(op)`      Runs the op in the current process. Used by:
 *                         (a) the daemon's IPC handler, and
 *                         (b) CLI commands as a fallback when no daemon.
 *   `routedDispatch(op)`  Entry point for CLI commands. Checks for a running
 *                         daemon: if yes, sends `applyOp` via IPC; if no,
 *                         calls dispatchOp locally.
 *
 * Both paths converge on the same `dispatchOp` function. There is no
 * "local" vs "routed" business logic — only a transport decision.
 *
 * ## Fallback correctness (important)
 *
 * `routedDispatch` must be careful about when it falls back to local
 * dispatch. If the daemon has already processed the write and only the
 * *response* got lost, a silent local fallback causes a double-write.
 *
 * The rule:
 *   - Pre-connect IPC failure (ECONNREFUSED, ENOENT, daemon not running at
 *     all) → SAFE to fall back. The write definitely did not land in the
 *     daemon's process because we never opened the connection.
 *   - Post-connect IPC failure (ECONNRESET, EPIPE, timeout mid-call) → NOT
 *     safe. The daemon may have processed the write. Error out and let the
 *     operator decide.
 *
 * This is the opposite of retry-everything semantics, on purpose. Brain
 * writes are append-mostly and deduplication is hard once the block lands.
 *
 * ## Adding a new op
 *
 *   1. Add the variant to the `BrainOp` discriminated union below.
 *   2. Add the case to `dispatchOp`'s switch statement.
 *   3. Replace the `applyBrainChange(doc, closure)` call in your command
 *      with `routedDispatch({type: 'yourOp', ...})`.
 *
 * The daemon's IPC handler is a one-line `return dispatchOp(params.op)` —
 * it does not need to be updated for new ops.
 */

import { applyBrainChange } from './brain';
import { getRunningDaemonPid, sendIpcRequest, BrainIpcError } from './brain-daemon';

// ---------------------------------------------------------------------------
// Op descriptors
// ---------------------------------------------------------------------------

export interface AppendLessonOp {
  type: 'appendLesson';
  docId: string;
  id: string;
  title: string;
  body: string;
  author: string;
  timestamp: number;
}

export interface EditLessonOp {
  type: 'editLesson';
  docId: string;
  lessonId: string;
  fields: {
    title?: string;
    body?: string;
    author?: string;
  };
  /** Bump the lesson's timestamp to now(), even when no fields change. */
  touch: boolean;
}

export interface RemoveLessonOp {
  type: 'removeLesson';
  docId: string;
  lessonId: string;
  removedBy: string;
  removedAt: number;
  removedReason?: string;
}

export interface NewProjectOp {
  type: 'newProject';
  docId: string;
  projectId: string;
  /** Display name — matches the `name` field on the stored project object. */
  name: string;
  /** Optional short-form brief; omitted field when undefined. */
  brief?: string;
  /** Starting lifecycle stage (propose / discuss / plan / vote / execute / review / ship). */
  stage: string;
  /** Proposer label — default is lowercased wallet address. */
  proposedBy: string;
  /** Unix seconds — recorded as `proposedAt` on the stored project. */
  proposedAt: number;
}

export interface AdvanceStageOp {
  type: 'advanceStage';
  docId: string;
  projectId: string;
  /** New lifecycle stage. */
  newStage: string;
  /** Unix seconds — recorded as `lastStageAdvanceAt` on the project. */
  lastStageAdvanceAt: number;
}

export interface RemoveProjectOp {
  type: 'removeProject';
  docId: string;
  projectId: string;
  removedBy: string;
  removedAt: number;
  removedReason?: string;
}

export type BrainOp =
  | AppendLessonOp
  | EditLessonOp
  | RemoveLessonOp
  | NewProjectOp
  | AdvanceStageOp
  | RemoveProjectOp;

export interface DispatchResult {
  headCid: string;
  /** The Ethereum address that signed the envelope (from POP_PRIVATE_KEY). */
  envelopeAuthor: string;
  /** True iff the op was routed through a running brain daemon. */
  routedViaDaemon: boolean;
}

// ---------------------------------------------------------------------------
// Local dispatch — runs in the current process
// ---------------------------------------------------------------------------

/**
 * Apply a BrainOp in the current process. Translates the op descriptor to
 * the corresponding Automerge change function and calls `applyBrainChange`,
 * which signs the envelope, writes the block, updates the manifest, and
 * publishes the new head CID via gossipsub.
 *
 * Same function is called from two places:
 *   - The daemon's `applyOp` IPC handler (when a CLI routed a write)
 *   - The CLI's `routedDispatch` fallback (when no daemon is running)
 *
 * Errors thrown from the change function propagate out as normal Error
 * instances. For example, editLesson throws if the target lesson id is
 * missing.
 */
export async function dispatchOp(op: BrainOp): Promise<DispatchResult> {
  let applied: { headCid: string; author: string; doc: any };

  switch (op.type) {
    case 'appendLesson': {
      applied = await applyBrainChange(op.docId, (doc: any) => {
        if (!Array.isArray(doc.lessons)) doc.lessons = [];
        doc.lessons.push({
          id: op.id,
          title: op.title,
          author: op.author,
          body: op.body,
          timestamp: op.timestamp,
        });
      });
      break;
    }

    case 'editLesson': {
      applied = await applyBrainChange(op.docId, (doc: any) => {
        if (!Array.isArray(doc.lessons)) {
          throw new Error(`no lessons list in doc ${op.docId}`);
        }
        const lesson = doc.lessons.find((l: any) => l && l.id === op.lessonId);
        if (!lesson) {
          throw new Error(`lesson ${op.lessonId} not found in ${op.docId}`);
        }
        if (op.fields.title !== undefined) lesson.title = op.fields.title;
        if (op.fields.body !== undefined) lesson.body = op.fields.body;
        if (op.fields.author !== undefined) lesson.author = op.fields.author;
        if (op.touch) lesson.timestamp = Math.floor(Date.now() / 1000);
      });
      break;
    }

    case 'removeLesson': {
      applied = await applyBrainChange(op.docId, (doc: any) => {
        if (!Array.isArray(doc.lessons)) {
          throw new Error(`no lessons list in doc ${op.docId}`);
        }
        const lesson = doc.lessons.find((l: any) => l && l.id === op.lessonId);
        if (!lesson) {
          throw new Error(`lesson ${op.lessonId} not found in ${op.docId}`);
        }
        // Soft-delete tombstone — see brain-projections.ts filter logic.
        lesson.removed = true;
        lesson.removedAt = op.removedAt;
        lesson.removedBy = op.removedBy;
        if (op.removedReason) lesson.removedReason = op.removedReason;
      });
      break;
    }

    case 'newProject': {
      applied = await applyBrainChange(op.docId, (doc: any) => {
        if (!Array.isArray(doc.projects)) doc.projects = [];
        // Collision check — upstream should have resolved with slug + suffix,
        // but we defend here because routedDispatch is the last line before
        // applyBrainChange.
        if (doc.projects.some((p: any) => p && p.id === op.projectId)) {
          throw new Error(`project id ${op.projectId} already exists in ${op.docId}`);
        }
        const entry: any = {
          id: op.projectId,
          name: op.name,
          stage: op.stage,
          proposedBy: op.proposedBy,
          proposedAt: op.proposedAt,
        };
        if (op.brief !== undefined && op.brief !== '') entry.brief = op.brief;
        doc.projects.push(entry);
      });
      break;
    }

    case 'advanceStage': {
      applied = await applyBrainChange(op.docId, (doc: any) => {
        if (!Array.isArray(doc.projects)) {
          throw new Error(`no projects list in doc ${op.docId}`);
        }
        const idx = doc.projects.findIndex((p: any) => p && p.id === op.projectId);
        if (idx === -1) {
          throw new Error(`project ${op.projectId} not found in ${op.docId}`);
        }
        const project = doc.projects[idx];
        if (project.removed) {
          throw new Error(`project ${op.projectId} is tombstoned — cannot advance`);
        }
        project.stage = op.newStage;
        project.lastStageAdvanceAt = op.lastStageAdvanceAt;
      });
      break;
    }

    case 'removeProject': {
      applied = await applyBrainChange(op.docId, (doc: any) => {
        if (!Array.isArray(doc.projects)) {
          throw new Error(`no projects list in doc ${op.docId}`);
        }
        const project = doc.projects.find((p: any) => p && p.id === op.projectId);
        if (!project) {
          throw new Error(`project ${op.projectId} not found in ${op.docId}`);
        }
        project.removed = true;
        project.removedAt = op.removedAt;
        project.removedBy = op.removedBy;
        if (op.removedReason) project.removedReason = op.removedReason;
      });
      break;
    }

    default: {
      // Exhaustiveness check — TypeScript will complain if a BrainOp variant
      // is missing from the switch.
      const _exhaustive: never = op;
      throw new Error(`Unknown BrainOp type: ${(_exhaustive as any)?.type}`);
    }
  }

  return {
    headCid: applied.headCid,
    envelopeAuthor: applied.author,
    routedViaDaemon: false,
  };
}

// ---------------------------------------------------------------------------
// Routed dispatch — sends to daemon when running, falls back locally
// ---------------------------------------------------------------------------

/**
 * Route a BrainOp through a running brain daemon, or run it locally if no
 * daemon is up.
 *
 * Fallback safety: we only fall back on PRE-CONNECT IPC errors (daemon not
 * running, socket missing, connection refused). POST-CONNECT errors leave
 * the write in an unknown state, so we error out and ask the operator to
 * verify. See module header comment for the full rationale.
 */
export async function routedDispatch(op: BrainOp): Promise<DispatchResult> {
  const daemonPid = getRunningDaemonPid();
  if (daemonPid === null) {
    // No daemon → run locally. Correct + safe.
    return await dispatchOp(op);
  }

  try {
    const ipcResult = await sendIpcRequest('applyOp', { op }, 15_000);
    return {
      headCid: ipcResult.headCid,
      envelopeAuthor: ipcResult.envelopeAuthor,
      routedViaDaemon: true,
    };
  } catch (err: any) {
    // BrainIpcError carries a `.phase` field: 'pre-connect' means the
    // connection was never established (safe to fall back); 'post-connect'
    // means the write may or may not have landed (ambiguous — do NOT fall
    // back, surface to operator).
    const isPreConnect =
      err instanceof BrainIpcError
        ? err.phase === 'pre-connect'
        : (err?.code === 'ECONNREFUSED' || err?.code === 'ENOENT');

    if (isPreConnect) {
      return await dispatchOp(op);
    }

    throw new Error(
      `Brain IPC failed mid-call (PID ${daemonPid}): ${err?.message ?? err}. ` +
      `The write may or may not have landed in the daemon. ` +
      `Verify with: pop brain read --doc ${op.docId} — and then either ` +
      `retry the command or stop the daemon (pop brain daemon stop) before retrying.`,
    );
  }
}
