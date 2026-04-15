#!/usr/bin/env node
/**
 * verify-stuck-task.mjs — on-chain event-replay for tasks where the subgraph
 * has dropped fields or failed to index Submit/Claim events.
 *
 * Context: HB#488 discovered that the Gnosis subgraph indexer drops event
 * fields on post-HB#417 tasks from the PR #10 merge window. Tasks show
 * status=Submitted with null assignee/completer/submission in the subgraph
 * API, making them invisible to `pop agent triage`'s pending-reviews
 * surface. But the on-chain state is fully intact.
 *
 * This script bypasses the subgraph entirely: scan the TaskManager contract's
 * own event logs for a specific task ID and print the full lifecycle
 * (Created → Claimed → Submitted → Completed/Rejected) with block numbers,
 * addresses, and decoded title/submission fields.
 *
 * USAGE:
 *   node agent/scripts/verify-stuck-task.mjs <taskId> [--chain 100]
 *
 * EXAMPLE:
 *   node agent/scripts/verify-stuck-task.mjs 378
 *   → prints:
 *     Task #378 on-chain lifecycle
 *     TaskCreated @ block 45689876 (title "Fix pop vote list subgraph...")
 *     TaskClaimed @ block 45690098 by sentinel_01 (0xC04C8604...)
 *     TaskSubmitted @ block 45690149 (submissionHash 0x82eb91b7...)
 *     [no TaskCompleted event — still awaiting review]
 *
 * Cross-references:
 *   - HB#488 brain lesson 'subgraph-indexer-is-dropping-fields-on-sentinel-01-s-submitted'
 *   - Task #378 (the pop vote list mitigation — itself stuck in the bug it was filed to fix)
 *   - TaskManager address discovered via subgraph organization(orgId).taskManager.id
 */

import { ethers } from 'ethers';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const tmAbi = require('../../src/abi/TaskManagerNew.json');

const taskId = process.argv[2];
const chainArg = process.argv.find(a => a.startsWith('--chain='))?.split('=')[1] || '100';
if (!taskId || isNaN(parseInt(taskId))) {
  console.error('Usage: node agent/scripts/verify-stuck-task.mjs <taskId> [--chain=100]');
  process.exit(1);
}

// TaskManager address for the Argus deployment on Gnosis mainnet.
// Discover via: pop agent triage + subgraph organization(orgId).taskManager.id
// Hardcoded for Argus here; accept an env var override for other orgs.
const TM_BY_CHAIN = {
  '100': '0xd17d6038ed29ac294cf8cdc4efc87d30261b77dc', // Argus on Gnosis
};
const TM_ADDR = process.env.TASK_MANAGER_ADDR || TM_BY_CHAIN[chainArg];
if (!TM_ADDR) {
  console.error(`No TaskManager address for chain ${chainArg}. Set TASK_MANAGER_ADDR env var.`);
  process.exit(1);
}

const RPC_BY_CHAIN = {
  '100': 'https://rpc.gnosischain.com',
  '1': 'https://ethereum-rpc.publicnode.com',
};
const RPC = process.env.RPC_URL || RPC_BY_CHAIN[chainArg];

const provider = new ethers.providers.JsonRpcProvider(RPC, parseInt(chainArg));
const tm = new ethers.Contract(TM_ADDR, tmAbi, provider);

// Events that form a task's lifecycle. Order matters for pretty-print.
const LIFECYCLE_EVENTS = [
  'TaskCreated',
  'TaskApplicationSubmitted',
  'TaskApplicationApproved',
  'TaskClaimed',
  'TaskAssigned',
  'TaskSubmitted',
  'TaskCompleted',
  'TaskRejected',
  'TaskCancelled',
  'TaskUpdated',
];

function hexToUtf8(hex) {
  if (!hex || !hex.startsWith('0x')) return hex;
  try {
    return ethers.utils.toUtf8String(hex);
  } catch {
    return hex;
  }
}

(async () => {
  const latest = await provider.getBlockNumber();
  // ~30 days of Gnosis blocks at ~5s → ~500k. Use 300k as default window.
  const lookback = parseInt(process.env.LOOKBACK_BLOCKS || '300000');
  const from = Math.max(0, latest - lookback);

  console.log(`\n  Task #${taskId} on-chain lifecycle`);
  console.log(`  TaskManager: ${TM_ADDR}`);
  console.log(`  Scan range:  blocks ${from} to ${latest} (${lookback} blocks, ~${Math.round(lookback * 5 / 86400)} days)`);
  console.log();

  const matches = [];
  for (const evName of LIFECYCLE_EVENTS) {
    let logs;
    try {
      const filter = tm.filters[evName]();
      logs = await tm.queryFilter(filter, from, latest);
    } catch (err) {
      console.error(`  [${evName}] query failed: ${err.message?.slice(0, 80) || err}`);
      continue;
    }
    for (const log of logs) {
      const args = log.args || {};
      // First positional arg is always taskId by TaskManager convention
      const logTaskId = args.id?.toString() || args.taskId?.toString() || args[0]?.toString();
      if (logTaskId === taskId) {
        matches.push({ eventName: evName, log, args });
      }
    }
  }

  if (matches.length === 0) {
    console.log(`  ✗ No events found for task #${taskId} in the scan window.`);
    console.log(`  Widen via LOOKBACK_BLOCKS=1000000 or verify TaskManager address is correct.`);
    process.exit(1);
  }

  matches.sort((a, b) => a.log.blockNumber - b.log.blockNumber);
  for (const m of matches) {
    console.log(`  ${m.eventName.padEnd(28)} @ block ${m.log.blockNumber}`);
    const keys = Object.keys(m.args).filter(k => isNaN(parseInt(k)));
    for (const k of keys) {
      let v = m.args[k];
      if (typeof v === 'object' && v._hex) v = v._hex;
      else if (typeof v === 'string' && v.startsWith('0x') && v.length > 42 && k === 'title') {
        v = hexToUtf8(v);
      }
      console.log(`    ${k}: ${v}`);
    }
    console.log();
  }

  // Summary: determine current on-chain status by examining which events fired
  const events = new Set(matches.map(m => m.eventName));
  let status;
  if (events.has('TaskCompleted')) status = 'Completed';
  else if (events.has('TaskRejected')) status = 'Rejected (may be re-submittable)';
  else if (events.has('TaskSubmitted')) status = 'Submitted (awaiting review)';
  else if (events.has('TaskClaimed') || events.has('TaskAssigned')) status = 'Claimed (in progress)';
  else if (events.has('TaskCreated')) status = 'Created (open for claim)';
  else status = 'Unknown';

  console.log(`  ──────────────────────────────────────`);
  console.log(`  Inferred on-chain status: ${status}`);
  console.log(`  Matched events: ${matches.length}`);
})();
