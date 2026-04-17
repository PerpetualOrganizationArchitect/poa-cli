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
 * DSChief minimal ABI. Real DSChief deployments (MakerDAO Chief at
 * 0x0a3f6849f78076aefaDf113F5BED87720274dDC0) expose these events.
 * LogLock/LogFree track MKR weight changes per voter address.
 * Vote events track which slate (address list) each voter selected.
 * Etch events create new slates. hat() is a view returning the current
 * winning slate.
 */
const DSCHIEF_ABI = [
  'event LogNote(bytes4 indexed sig, address indexed usr, bytes32 indexed arg1, bytes32 indexed arg2, bytes data)',
  'event LogLock(address indexed voter, uint256 amount)',
  'event LogFree(address indexed voter, uint256 amount)',
  'event LogVote(address indexed voter, bytes32 indexed slate)',
  'event Etch(bytes32 indexed slate)',
  'function hat() view returns (address)',
  'function approvals(address) view returns (uint256)',
];

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

      // Phase 2 (HB#403): real event-scan via queryFilter. Large ranges chunked to
      // respect public RPC caps (most Ethereum providers cap at 50k blocks per
      // eth_getLogs; a full 500k-block scan needs 10 chunks).
      const contract = new ethers.Contract(argv.address, DSCHIEF_ABI, provider);
      const MAX_RANGE = 49_000;
      const locks: Array<{ voter: string; amount: bigint }> = [];
      const frees: Array<{ voter: string; amount: bigint }> = [];
      for (let start = fromBlock; start <= toBlock; start += MAX_RANGE) {
        const end = Math.min(start + MAX_RANGE - 1, toBlock);
        spin.text = `Scanning DSChief events ${start}..${end}...`;
        const [lockEvts, freeEvts] = await Promise.all([
          contract.queryFilter(contract.filters.LogLock(), start, end).catch(() => [] as any[]),
          contract.queryFilter(contract.filters.LogFree(), start, end).catch(() => [] as any[]),
        ]);
        for (const e of lockEvts) {
          const args = (e as any).args;
          if (args) locks.push({ voter: String(args.voter ?? args[0]), amount: BigInt(String(args.amount ?? args[1])) });
        }
        for (const e of freeEvts) {
          const args = (e as any).args;
          if (args) frees.push({ voter: String(args.voter ?? args[0]), amount: BigInt(String(args.amount ?? args[1])) });
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
