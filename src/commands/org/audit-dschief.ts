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
  /** Placeholder for Phase 2. Will contain: voters[], top-N by weight, gini, etc. */
  status: 'scaffold' | 'partial' | 'complete';
  note?: string;
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

      const result: DschiefAuditResult = {
        contract: argv.address,
        chainId,
        scanWindow: { fromBlock, toBlock },
        status: 'scaffold',
        note: 'HB#402 scaffold — event-scan + Gini computation deferred to HB#403+ follow-up. Task #472 claimed; Phase 2 pending.',
      };

      spin.stop();
      if (argv.json) {
        output.json(result);
      } else {
        output.info(`DSChief audit scaffold ready for ${argv.address}`);
        output.info(`  chain: ${chainId}`);
        output.info(`  scan window: blocks ${fromBlock}..${toBlock} (${toBlock - fromBlock} blocks)`);
        output.info(`  status: ${result.status}`);
        output.info(`  note: ${result.note}`);
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exitCode = 1;
    }
  },
};
