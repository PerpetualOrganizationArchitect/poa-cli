/**
 * Task #385 (HB#236) — on-chain fallback probe for the pop task subgraph-lag
 * zombie-state bug. Symmetric companion to Task #378's vote/list probe helper.
 *
 * Context: `pop task view` and `pop task list` both read from the POP
 * subgraph, which periodically falls behind the chain by 30+ task IDs
 * (HB#223 brain lesson: task-list-stuck-at-367 was a 60+ HB unrecognized
 * symptom of this class of bug). When the subgraph misses a TaskCreated
 * event, any subsequent call that looks up the task by ID returns
 * "not found", even though the task exists on-chain.
 *
 * This module provides `probeTaskOnChain(taskManagerAddr, taskId, provider)`
 * which scans recent TaskCreated / TaskClaimed / TaskAssigned / TaskSubmitted /
 * TaskCompleted / TaskCancelled / TaskRejected events emitted by the
 * TaskManager contract, reconstructs the latest lifecycle state from the
 * event stream, and returns a minimal task shape that callers can display
 * when the subgraph is stale.
 *
 * Cost guard: callers should only invoke this when the subgraph returned
 * "not found" — normal lookups pay zero RPC cost. On cache miss the probe
 * does a single getLogs call with a ~10_000-block lookback (roughly 12
 * hours on Gnosis at 5s blocks), which is the minimum needed to cover the
 * worst-observed subgraph lag. If the task was created earlier than that,
 * the probe returns null and the caller should widen the window manually.
 *
 * Scope: this is a minimum-viable probe for the "task not found" case. It
 * does NOT reconstruct applications, per-rejector metadata, or IPFS
 * metadata — those remain subgraph-exclusive. The probe answers "does
 * this task exist and what's its current status" only, which is enough
 * to unblock the agent-verification workflow that hits this bug most.
 */

import { ethers } from 'ethers';
import TaskManagerAbi from '../../abi/TaskManagerNew.json';

export type ProbedTaskStatus =
  | 'Created'
  | 'Claimed'
  | 'Assigned'
  | 'Submitted'
  | 'Completed'
  | 'Cancelled'
  | 'Rejected';

export interface ProbedTask {
  taskId: string;
  status: ProbedTaskStatus;
  title?: string;
  metadataHash?: string;
  payout?: string;
  bountyToken?: string;
  bountyPayout?: string;
  assignee?: string;
  claimer?: string;
  completer?: string;
  projectId?: string;
  createdBlock: number;
  lastEventBlock: number;
}

const LIFECYCLE_EVENTS = [
  'TaskCreated',
  'TaskClaimed',
  'TaskAssigned',
  'TaskSubmitted',
  'TaskCompleted',
  'TaskCancelled',
  'TaskRejected',
];

// Maps a lifecycle event name to the status it produces. TaskCreated is
// the initial state; later events override it. If both Claimed and
// Assigned appear for the same task, the later-block event wins.
const EVENT_TO_STATUS: Record<string, ProbedTaskStatus> = {
  TaskCreated: 'Created',
  TaskClaimed: 'Claimed',
  TaskAssigned: 'Assigned',
  TaskSubmitted: 'Submitted',
  TaskCompleted: 'Completed',
  TaskCancelled: 'Cancelled',
  TaskRejected: 'Rejected',
};

/**
 * Probe the TaskManager contract for a task by ID via event log scanning.
 * Returns null if the TaskCreated event is not found within the lookback
 * window (default 10_000 blocks ≈ 12h on Gnosis).
 */
export async function probeTaskOnChain(
  taskManagerAddr: string,
  taskId: string | number,
  provider: ethers.providers.Provider,
  opts: { lookbackBlocks?: number } = {}
): Promise<ProbedTask | null> {
  const lookback = opts.lookbackBlocks ?? 10_000;
  const latestBlock = await provider.getBlockNumber();
  const fromBlock = Math.max(0, latestBlock - lookback);

  const contract = new ethers.Contract(taskManagerAddr, TaskManagerAbi as any, provider);
  const taskIdBN = ethers.BigNumber.from(taskId);

  // Collect events across the full lifecycle in parallel. The uint256 id
  // is the first indexed topic on every lifecycle event, so we can query
  // each event type with the same filter shape.
  const allEvents: Array<{ name: string; event: ethers.Event }> = [];
  const queries = LIFECYCLE_EVENTS.map(async (eventName) => {
    try {
      const filter = contract.filters[eventName](taskIdBN);
      const events = await contract.queryFilter(filter, fromBlock, latestBlock);
      for (const ev of events) {
        allEvents.push({ name: eventName, event: ev });
      }
    } catch {
      // Some events may not be filterable on certain providers — skip.
    }
  });
  await Promise.all(queries);

  if (allEvents.length === 0) return null;

  // Sort by (blockNumber, logIndex) ascending so the latest event is last.
  allEvents.sort((a, b) => {
    if (a.event.blockNumber !== b.event.blockNumber) {
      return a.event.blockNumber - b.event.blockNumber;
    }
    return a.event.logIndex - b.event.logIndex;
  });

  const createdEvent = allEvents.find((e) => e.name === 'TaskCreated');
  if (!createdEvent) {
    // No TaskCreated event in the window — the task may exist but was
    // created earlier than the lookback. Callers can retry with a wider
    // window if they know the approximate creation block.
    return null;
  }

  // Reconstruct the task from events. TaskCreated has all the static
  // fields; later events override status and actor fields.
  const result: ProbedTask = {
    taskId: taskIdBN.toString(),
    status: 'Created',
    createdBlock: createdEvent.event.blockNumber,
    lastEventBlock: createdEvent.event.blockNumber,
  };

  const createdArgs = createdEvent.event.args as any;
  if (createdArgs) {
    // title is bytes (dynamic utf8) — decode defensively
    try {
      result.title = ethers.utils.toUtf8String(createdArgs.title);
    } catch { /* leave undefined */ }
    result.metadataHash = createdArgs.metadataHash;
    result.payout = createdArgs.payout?.toString();
    result.bountyToken = createdArgs.bountyToken;
    result.bountyPayout = createdArgs.bountyPayout?.toString();
    result.projectId = createdArgs.project;
  }

  for (const { name, event } of allEvents) {
    const args = event.args as any;
    if (!args) continue;
    if (name === 'TaskClaimed') result.claimer = args.claimer;
    if (name === 'TaskAssigned') result.assignee = args.assignee;
    if (name === 'TaskCompleted') result.completer = args.completer;
    // Status transitions: later event in the sorted list wins.
    result.status = EVENT_TO_STATUS[name] || result.status;
    result.lastEventBlock = event.blockNumber;
  }

  return result;
}
