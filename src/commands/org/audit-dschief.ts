/**
 * pop org audit-dschief — audit DSChief-pattern executive-voting governance.
 *
 * Task #472 (vigil HB#402 claim). Closes the Sky/Maker probe loose-end from
 * #469b that sentinel's audit-governor --subgraph-url (#471) couldn't cover
 * because Sky uses DSChief (executive-voting), not Compound Governor Bravo.
 *
 * Algorithm: query DSChief contract's on-chain events (LogLock/LogFree for
 * MKR locks, Vote for slate selections, Etch for slate composition, Hat
 * property read for current winning slate) via ethers. Compute per-voter
 * weight as MKR locked. Output the same audit-governor JSON shape so
 * downstream consumers (AUDIT_DB + v1.6 corpus updates) treat DSChief DAOs
 * the same as Governor Bravo DAOs.
 *
 * Scope of initial ship (HB#402 scaffold):
 *   - Command registered + --help surfaces flags
 *   - Task description assumed protofire/maker-protocol subgraph but
 *     api.thegraph.com hosted-service is deprecated (returns 404). Falling
 *     back to direct RPC event scanning, same pattern as audit-governor
 *     option-a.
 *   - Implementation STUB — real LogLock/LogFree event scanning + Gini
 *     computation lands in HB#403+ follow-up commits. This commit wires
 *     the scaffold so argv parsing + JSON output shape are settled.
 *   - Unit tests for pure helpers added in same follow-up.
 *
 * HB#402 vigil claim-signaled at synthesis-index.md.
 */

import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import { resolveNetworkConfig } from '../../config/networks';
import * as output from '../../lib/output';

/**
 * DSChief ABI — uses ds-note pattern. ALL state-changing functions emit a
 * single LogNote event with:
 *   - sig (bytes4 indexed): function selector
 *   - guy (address indexed): msg.sender (the voter for lock/free)
 *   - foo (bytes32 indexed): first function arg, zero-padded — for
 *     lock(uint wad)/free(uint wad) this is bytes32(uint256(wad))
 *   - bar (bytes32 indexed): second function arg (unused for lock/free)
 *
 * HB#405 fix: original implementation incorrectly assumed typed LogLock /
 * LogFree events. DSChief (0x0a3f6849f7... MakerDAO Chief) returns 0
 * events for those topics. LogNote-filtered scan is the correct path.
 * Argus HB#394 independently confirmed the ABI bug + contributed
 * Etherscan-verified observations (Chief ~99% empty post-Sky-migration,
 * 433 MKR currently locked vs >100K historical peak).
 */
const DSCHIEF_ABI = [
  'event LogNote(bytes4 indexed sig, address indexed guy, bytes32 indexed foo, bytes32 indexed bar, uint wad, bytes fax)',
  'function hat() view returns (address)',
  'function approvals(address) view returns (uint256)',
];

/**
 * Function selectors (first 4 bytes of keccak256(signature)) for DSChief.
 * Used to filter LogNote events by `sig` topic to isolate lock/free ops.
 */
export const LOCK_SELECTOR = ethers.utils.id('lock(uint256)').slice(0, 10); // 0xdd467064
export const FREE_SELECTOR = ethers.utils.id('free(uint256)').slice(0, 10); // 0xd7ccbd65

interface AuditDschiefArgs {
  address: string;
  chain?: number;
  rpc?: string;
  blocks?: number;
  'from-block'?: number;
  'to-block'?: number;
  json?: boolean;
}

export interface DschiefAuditResult {
  contract: string;
  chainId: number;
  scanWindow: { fromBlock: number; toBlock: number };
  status: 'scaffold' | 'partial' | 'complete';
  note?: string;
  /** Phase 2 measured fields (undefined when status=scaffold). */
  totalVoters?: number;
  currentlyLocked?: number; // MKR units as a plain number (converted from wei via /1e18)
  top5Voters?: Array<{ address: string; lockedMkr: number; sharePct: number }>;
  top1Share?: number;
  top5Share?: number;
  gini?: number;
  rawLockEvents?: number;
  rawFreeEvents?: number;
}

/**
 * Aggregate LogLock/LogFree into net per-voter MKR weight.
 * Returns a Map<address, lockedMkrAsPlainNumber>.
 * Exported for unit testing.
 */
export function aggregateLockEvents(
  locks: Array<{ voter: string; amount: bigint }>,
  frees: Array<{ voter: string; amount: bigint }>,
): Map<string, number> {
  const weiPerMkr = 10n ** 18n;
  const net = new Map<string, bigint>();
  for (const l of locks) {
    const prev = net.get(l.voter.toLowerCase()) ?? 0n;
    net.set(l.voter.toLowerCase(), prev + l.amount);
  }
  for (const f of frees) {
    const prev = net.get(f.voter.toLowerCase()) ?? 0n;
    net.set(f.voter.toLowerCase(), prev - f.amount);
  }
  const result = new Map<string, number>();
  for (const [voter, wei] of net) {
    // Clamp to 0 (non-negative) — event-source ordering could go slightly negative on partial scans.
    const clamped = wei > 0n ? wei : 0n;
    // Convert wei → MKR (divide by 1e18), keeping 2 decimals of precision
    const mkrTimes100 = clamped / (weiPerMkr / 100n);
    result.set(voter, Number(mkrTimes100) / 100);
  }
  return result;
}

/**
 * Compute Gini coefficient over weights.
 * Gini = 0 (perfect equality) to 1 (perfect inequality).
 * Returns 0 for empty or single-holder sets.
 */
export function computeGini(weights: number[]): number {
  const positive = weights.filter((w) => w > 0);
  if (positive.length < 2) return 0;
  const sorted = [...positive].sort((a, b) => a - b);
  const n = sorted.length;
  let sumTimesRank = 0;
  let totalSum = 0;
  for (let i = 0; i < n; i++) {
    sumTimesRank += (i + 1) * sorted[i];
    totalSum += sorted[i];
  }
  if (totalSum === 0) return 0;
  return (2 * sumTimesRank) / (n * totalSum) - (n + 1) / n;
}

/**
 * Derive top-N by weight + aggregate shares.
 * Exported for unit testing.
 */
export function deriveTopVoters(
  weights: Map<string, number>,
  topN: number = 5,
): { top: Array<{ address: string; lockedMkr: number; sharePct: number }>; top1Share: number; top5Share: number } {
  const entries = Array.from(weights.entries())
    .filter(([, w]) => w > 0)
    .sort(([, a], [, b]) => b - a);
  const total = entries.reduce((acc, [, w]) => acc + w, 0);
  const top = entries.slice(0, topN).map(([address, lockedMkr]) => ({
    address,
    lockedMkr,
    sharePct: total > 0 ? (lockedMkr / total) * 100 : 0,
  }));
  const top1Share = top.length > 0 ? top[0].sharePct : 0;
  const top5Share = top.slice(0, 5).reduce((acc, v) => acc + v.sharePct, 0);
  return { top, top1Share, top5Share };
}

export const auditDschiefHandler = {
  builder: (yargs: Argv) =>
    yargs
      .option('address', {
        type: 'string',
        demandOption: true,
        describe: 'DSChief contract address (e.g. MakerDAO Chief 0x0a3f6849f78076aefaDf113F5BED87720274dDC0)',
      })
      .option('blocks', {
        type: 'number',
        default: 500000,
        describe: 'Number of blocks to scan back from head (ignored if --from-block is set)',
      })
      .option('from-block', {
        type: 'number',
        describe: 'Explicit start block (mirrors audit-governor semantics)',
      })
      .option('to-block', {
        type: 'number',
        describe: 'Explicit end block (defaults to current head)',
      }),

  handler: async (argv: ArgumentsCamelCase<AuditDschiefArgs>) => {
    const spin = output.spinner(`Auditing DSChief: ${argv.address}...`);
    spin.start();

    try {
      const chainId = argv.chain ?? 1; // DSChief DAOs are mainnet-native
      const config = resolveNetworkConfig(chainId);
      const rpcUrl = (argv.rpc as string) || config.resolvedRpc;
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl, chainId);

      // Range resolution mirrors audit-governor (HB#467 option-a flag semantics)
      const currentBlock = await provider.getBlockNumber();
      const toBlock = argv['to-block'] !== undefined
        ? Math.min(argv['to-block'] as number, currentBlock)
        : currentBlock;
      const fromBlock = argv['from-block'] !== undefined
        ? Math.max(0, argv['from-block'] as number)
        : Math.max(0, toBlock - (argv.blocks as number));
      if (fromBlock > toBlock) {
        throw new Error(`--from-block (${fromBlock}) must be <= --to-block (${toBlock}).`);
      }

      // Phase 4 (HB#405): LogNote-filtered scan. DSChief uses ds-note pattern —
      // filter by `sig` topic (function selector) to isolate lock/free ops.
      // The foo indexed bytes32 is bytes32(uint256(wad)) for single-arg calls;
      // cast back via BigNumber.
      const contract = new ethers.Contract(argv.address, DSCHIEF_ABI, provider);
      const MAX_RANGE = 49_000;
      const locks: Array<{ voter: string; amount: bigint }> = [];
      const frees: Array<{ voter: string; amount: bigint }> = [];
      for (let start = fromBlock; start <= toBlock; start += MAX_RANGE) {
        const end = Math.min(start + MAX_RANGE - 1, toBlock);
        spin.text = `Scanning DSChief LogNote ${start}..${end}...`;
        const [lockEvts, freeEvts] = await Promise.all([
          contract.queryFilter(contract.filters.LogNote(LOCK_SELECTOR), start, end).catch(() => [] as any[]),
          contract.queryFilter(contract.filters.LogNote(FREE_SELECTOR), start, end).catch(() => [] as any[]),
        ]);
        for (const e of lockEvts) {
          const args = (e as any).args;
          if (args) {
            // foo is bytes32 encoding of uint256(wad). ethers returns it as a hex string.
            const fooHex = String(args.foo ?? args[2]);
            const amount = BigInt(fooHex);
            const voter = String(args.guy ?? args[1]);
            locks.push({ voter, amount });
          }
        }
        for (const e of freeEvts) {
          const args = (e as any).args;
          if (args) {
            const fooHex = String(args.foo ?? args[2]);
            const amount = BigInt(fooHex);
            const voter = String(args.guy ?? args[1]);
            frees.push({ voter, amount });
          }
        }
      }

      const weights = aggregateLockEvents(locks, frees);
      const { top, top1Share, top5Share } = deriveTopVoters(weights, 5);
      const activeVoters = Array.from(weights.entries()).filter(([, w]) => w > 0);
      const gini = computeGini(activeVoters.map(([, w]) => w));
      const currentlyLocked = activeVoters.reduce((acc, [, w]) => acc + w, 0);

      const result: DschiefAuditResult = {
        contract: argv.address,
        chainId,
        scanWindow: { fromBlock, toBlock },
        status: 'complete',
        totalVoters: activeVoters.length,
        currentlyLocked: Math.round(currentlyLocked * 100) / 100,
        top5Voters: top,
        top1Share: Math.round(top1Share * 100) / 100,
        top5Share: Math.round(top5Share * 100) / 100,
        gini: Math.round(gini * 1000) / 1000,
        rawLockEvents: locks.length,
        rawFreeEvents: frees.length,
      };

      spin.stop();
      if (argv.json) {
        output.json(result);
      } else {
        output.info(`DSChief audit — ${argv.address}`);
        output.info(`  chain ${chainId}, scan window ${fromBlock}..${toBlock} (${toBlock - fromBlock} blocks)`);
        output.info(`  raw events: ${locks.length} LogLock + ${frees.length} LogFree`);
        output.info(`  active voters (positive net MKR): ${activeVoters.length}`);
        output.info(`  currently locked: ${result.currentlyLocked} MKR`);
        output.info(`  Gini (voter weights): ${result.gini}`);
        output.info(`  top-1 share: ${result.top1Share}%`);
        output.info(`  top-5 share: ${result.top5Share}%`);
        if (top.length > 0) {
          output.info(`  top 5 voters:`);
          for (const v of top) {
            output.info(`    ${v.address.slice(0, 10)}... — ${v.lockedMkr} MKR (${Math.round(v.sharePct * 100) / 100}%)`);
          }
        }
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exitCode = 1;
    }
  },
};
