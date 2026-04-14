/**
 * pop brain doctor — single-command health check for brain layer setup.
 *
 * Answers "is my brain setup healthy?" in one invocation. Complements
 * `docs/brain-layer-setup.md` (setup doc tells you HOW; doctor tells
 * you IF the setup is actually working).
 *
 * Output shape:
 *   ✓ check name      — pass
 *   ⚠ check name      — warn (not fatal, but worth knowing)
 *   ✗ check name      — fail (exit 1)
 *
 * Exit codes:
 *   0 — all pass or pass+warn (warnings don't fail the run)
 *   1 — any ✗ fail
 *
 * --json returns { checks: [{name, status, detail, elapsed?}], summary }
 *
 * Design: every check is self-contained and independent. A failure in
 * one check does NOT stop later checks from running — the operator
 * wants the full picture, not the first stumble.
 */

import type { Argv, ArgumentsCamelCase } from 'yargs';
import { existsSync, accessSync, constants, readFileSync } from 'fs';
import { join } from 'path';
import { ethers } from 'ethers';
import {
  initBrainNode,
  stopBrainNode,
  getBrainHome,
} from '../../lib/brain';
import { isAllowedAuthor, loadAllowlist } from '../../lib/brain-signing';
import * as output from '../../lib/output';

type Status = 'pass' | 'warn' | 'fail' | 'info';

interface CheckResult {
  name: string;
  status: Status;
  detail: string;
  elapsed?: number;
}

const ADDRESS_RE = /^0x[0-9a-fA-F]{64}$/;

async function checkPrivateKey(): Promise<CheckResult> {
  const key = process.env.POP_PRIVATE_KEY;
  if (!key) {
    return {
      name: 'env: POP_PRIVATE_KEY',
      status: 'fail',
      detail: 'not set — export POP_PRIVATE_KEY or source ~/.pop-agent/.env',
    };
  }
  if (!ADDRESS_RE.test(key)) {
    return {
      name: 'env: POP_PRIVATE_KEY',
      status: 'fail',
      detail: `malformed — must be 0x-prefixed 64-char hex string (got ${key.length} chars)`,
    };
  }
  try {
    const addr = new ethers.Wallet(key).address.toLowerCase();
    return {
      name: 'env: POP_PRIVATE_KEY',
      status: 'pass',
      detail: `signs as ${addr}`,
    };
  } catch (err: any) {
    return {
      name: 'env: POP_PRIVATE_KEY',
      status: 'fail',
      detail: `invalid key — ${err.message}`,
    };
  }
}

function checkBrainHome(): CheckResult {
  const home = getBrainHome();
  try {
    accessSync(home, constants.W_OK);
    const source = process.env.POP_BRAIN_HOME ? 'override' : 'default';
    return {
      name: 'brain home',
      status: 'pass',
      detail: `${home} (${source}, writable)`,
    };
  } catch {
    return {
      name: 'brain home',
      status: 'fail',
      detail: `${home} is not writable`,
    };
  }
}

async function checkPeerKey(): Promise<CheckResult> {
  const path = join(getBrainHome(), 'peer-key.json');
  if (!existsSync(path)) {
    return {
      name: 'peer-key.json',
      status: 'info',
      detail: 'does not exist yet (will be created on next initBrainNode)',
    };
  }
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    if (typeof raw?.privateKey !== 'string' || !raw.privateKey.startsWith('0x')) {
      return {
        name: 'peer-key.json',
        status: 'warn',
        detail: 'malformed — missing hex privateKey field; delete to regenerate',
      };
    }
    const { privateKeyFromProtobuf } = await (new Function(
      's',
      'return import(s)',
    ) as any)('@libp2p/crypto/keys');
    const bytes = Uint8Array.from(Buffer.from(raw.privateKey.slice(2), 'hex'));
    const pk = privateKeyFromProtobuf(bytes);
    return {
      name: 'peer-key.json',
      status: 'pass',
      detail: `persisted format OK (${pk.type ?? 'key'}, round-trips through privateKeyFromProtobuf)`,
    };
  } catch (err: any) {
    return {
      name: 'peer-key.json',
      status: 'warn',
      detail: `unreadable (${err.message}) — delete to regenerate on next boot`,
    };
  }
}

async function checkLibp2pInit(): Promise<{ result: CheckResult; node: any }> {
  const start = Date.now();
  try {
    const node = await initBrainNode();
    const peerId = node.libp2p.peerId.toString();
    const elapsed = Date.now() - start;
    return {
      result: {
        name: 'libp2p init',
        status: 'pass',
        detail: `peer ${peerId.slice(0, 16)}...${peerId.slice(-8)}`,
        elapsed,
      },
      node,
    };
  } catch (err: any) {
    return {
      result: {
        name: 'libp2p init',
        status: 'fail',
        detail: `createLibp2p failed — ${err.message}`,
        elapsed: Date.now() - start,
      },
      node: null,
    };
  }
}

async function checkBootstrap(node: any): Promise<CheckResult> {
  if (!node) {
    return {
      name: 'bootstrap peers',
      status: 'info',
      detail: 'skipped (libp2p init failed)',
    };
  }
  // Wait up to 15 seconds for the peer store to contain at least one
  // bootstrap peer. Polls every 1s so we exit as soon as discovery
  // succeeds rather than always waiting the full 15.
  const start = Date.now();
  const deadline = start + 15_000;
  let found = 0;
  while (Date.now() < deadline) {
    try {
      const peers = await node.libp2p.peerStore.all();
      found = peers.length;
      if (found > 0) break;
    } catch {
      // ignore transient peer store errors
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  const elapsed = Date.now() - start;
  if (found === 0) {
    return {
      name: 'bootstrap peers',
      status: 'warn',
      detail: `0 peers after ${Math.round(elapsed / 1000)}s — DNS may be flaky, local reads still work`,
      elapsed,
    };
  }
  return {
    name: 'bootstrap peers',
    status: 'pass',
    detail: `${found} peer${found === 1 ? '' : 's'} in store after ${Math.round(elapsed / 1000)}s`,
    elapsed,
  };
}

function checkAllowlist(): CheckResult {
  const key = process.env.POP_PRIVATE_KEY;
  if (!key || !ADDRESS_RE.test(key)) {
    return {
      name: 'allowlist signer',
      status: 'info',
      detail: 'skipped (no valid POP_PRIVATE_KEY)',
    };
  }
  const allowlist = loadAllowlist();
  if (allowlist.length === 0) {
    return {
      name: 'allowlist signer',
      status: 'warn',
      detail: 'allowlist is empty — add at least one address via `pop brain allowlist add`',
    };
  }
  try {
    const addr = new ethers.Wallet(key).address.toLowerCase();
    if (isAllowedAuthor(addr)) {
      return {
        name: 'allowlist signer',
        status: 'pass',
        detail: `${addr} is allowlisted`,
      };
    }
    return {
      name: 'allowlist signer',
      status: 'warn',
      detail: `${addr} NOT in allowlist — reads work, writes won't propagate. Fix: pop brain allowlist add --address ${addr}`,
    };
  } catch {
    return {
      name: 'allowlist signer',
      status: 'info',
      detail: 'skipped (wallet construction failed)',
    };
  }
}

async function checkDynamicMembership(): Promise<CheckResult> {
  // Task #330: surface whether the on-chain dynamic allowlist is reachable
  // and how many authorized signers it resolves to. Falls back to a warn,
  // never a fail, because the static JSON is a legitimate offline path.
  const { tryFetchOrgMembers } = await import('../../lib/brain-membership');
  try {
    const members = await tryFetchOrgMembers();
    const staticCount = loadAllowlist().length;
    if (members === null) {
      return {
        name: 'dynamic allowlist',
        status: 'warn',
        detail: `subgraph unreachable — using static fallback (${staticCount} entries). Set POP_DEFAULT_ORG / POP_DEFAULT_CHAIN or check network.`,
      };
    }
    const mode =
      staticCount === 0 ? 'dynamic'
        : members.size === 0 ? 'static-only'
        : 'both';
    return {
      name: 'dynamic allowlist',
      status: 'pass',
      detail: `${members.size} on-chain member${members.size === 1 ? '' : 's'}, ${staticCount} static entries (mode: ${mode})`,
    };
  } catch (err: any) {
    return {
      name: 'dynamic allowlist',
      status: 'warn',
      detail: `check crashed — ${err?.message ?? 'unknown'}`,
    };
  }
}

function checkDocManifest(): CheckResult {
  const path = join(getBrainHome(), 'doc-heads.json');
  if (!existsSync(path)) {
    return {
      name: 'doc-heads manifest',
      status: 'info',
      detail: 'no manifest yet (no brain docs written from this home)',
    };
  }
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    const docIds = Object.keys(raw);
    return {
      name: 'doc-heads manifest',
      status: 'pass',
      detail: `${docIds.length} doc${docIds.length === 1 ? '' : 's'}${
        docIds.length > 0 ? ' — ' + docIds.slice(0, 3).join(', ') + (docIds.length > 3 ? ', ...' : '') : ''
      }`,
    };
  } catch (err: any) {
    return {
      name: 'doc-heads manifest',
      status: 'warn',
      detail: `unreadable — ${err.message}`,
    };
  }
}

async function checkSubscribedTopics(node: any): Promise<CheckResult> {
  if (!node) {
    return {
      name: 'subscribed topics',
      status: 'info',
      detail: 'skipped (libp2p init failed)',
    };
  }
  try {
    const pubsub = node.libp2p.services?.pubsub;
    if (!pubsub) {
      return {
        name: 'subscribed topics',
        status: 'warn',
        detail: 'pubsub service not configured',
      };
    }
    const topics: string[] = pubsub.getTopics?.() ?? [];
    if (topics.length === 0) {
      return {
        name: 'subscribed topics',
        status: 'info',
        detail: 'no topics subscribed (no local docs to auto-subscribe)',
      };
    }
    const peerSummary = topics
      .map((t) => {
        const n = pubsub.getSubscribers?.(t)?.length ?? 0;
        return `${t.replace(/^pop\/brain\//, '').replace(/\/v1$/, '')}(${n})`;
      })
      .join(', ');
    return {
      name: 'subscribed topics',
      status: 'pass',
      detail: `${topics.length} — ${peerSummary}`,
    };
  } catch (err: any) {
    return {
      name: 'subscribed topics',
      status: 'warn',
      detail: `inspection failed — ${err.message}`,
    };
  }
}

export const doctorHandler = {
  builder: (yargs: Argv) => yargs,
  handler: async (_argv: ArgumentsCamelCase<{}>) => {
    const checks: CheckResult[] = [];
    const spin = output.isJsonMode() ? null : output.spinner('Running brain health checks...');
    spin?.start();

    try {
      // Non-libp2p checks first (fast, synchronous).
      checks.push(await checkPrivateKey());
      checks.push(checkBrainHome());
      checks.push(await checkPeerKey());
      checks.push(checkAllowlist());
      checks.push(await checkDynamicMembership());
      checks.push(checkDocManifest());

      // libp2p init is the integration check — may take a few seconds.
      const { result: initResult, node } = await checkLibp2pInit();
      checks.push(initResult);

      // Bootstrap + topic checks only if libp2p init succeeded.
      checks.push(await checkBootstrap(node));
      checks.push(await checkSubscribedTopics(node));

      spin?.stop();

      const pass = checks.filter((c) => c.status === 'pass').length;
      const warn = checks.filter((c) => c.status === 'warn').length;
      const fail = checks.filter((c) => c.status === 'fail').length;
      const info = checks.filter((c) => c.status === 'info').length;

      if (output.isJsonMode()) {
        output.json({
          status: fail > 0 ? 'error' : 'ok',
          checks,
          summary: { pass, warn, fail, info },
        });
      } else {
        console.log('');
        console.log('  Brain health check');
        console.log('  ' + '─'.repeat(60));
        for (const c of checks) {
          const icon =
            c.status === 'pass' ? '✓' :
            c.status === 'warn' ? '⚠' :
            c.status === 'fail' ? '✗' : 'ℹ';
          const line = `  ${icon} ${c.name.padEnd(24)} ${c.detail}`;
          console.log(line);
        }
        console.log('');
        console.log(`  Summary: ${pass} pass · ${warn} warn · ${fail} fail · ${info} info`);
        console.log('');
      }

      if (fail > 0) process.exitCode = 1;
    } catch (err: any) {
      spin?.stop();
      output.error(`brain doctor crashed: ${err.message}`);
      process.exitCode = 1;
    } finally {
      await stopBrainNode();
    }
  },
};
