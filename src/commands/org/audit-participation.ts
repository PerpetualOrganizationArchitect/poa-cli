/**
 * pop org audit-participation — governance participation metrics for external governors.
 *
 * Task #422 (HB#256, Sprint 16 P2). Reads VoteCast events from Governor
 * contracts (Bravo/OZ/Alpha) and reports participation metrics: proposal count,
 * unique voter count, average voters per proposal, top-N voters by frequency.
 *
 * Usage:
 *   pop org audit-participation \
 *     --address 0xc0Da02939E1441F497fd74F78cE7Decb17B66529 \
 *     --top 10 --chain 1 [--from-block N] [--json]
 */

import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import { resolveNetworkConfig, getNetworkByChainId } from '../../config/networks';
import * as output from '../../lib/output';

/**
 * Repeat-vote ratio: total vote casts divided by unique voters over the
 * scan window. A ratio of 1.0 means every voter voted exactly once (refreshing
 * electorate); a ratio of 4+ means each voter voted on average 4+ times (
 * small dedicated core pattern). Defined in HB#329 capture-cluster rule-B
 * proposal: `agent/artifacts/research/capture-cluster-rule-b-proposal.md`.
 * Returns 0 for empty window (safer than NaN for consumers).
 */
export function computeRepeatVoteRatio(totalVoteCasts: number, uniqueVoters: number): number {
  if (uniqueVoters <= 0) return 0;
  return Number((totalVoteCasts / uniqueVoters).toFixed(2));
}

/**
 * Rule-B capture diagnostic (HB#329 proposal): DAO belongs in the
 * single-whale-capture-cluster (`single-whale-capture-cluster.md`) if the
 * repeat-vote ratio exceeds 4 AND the unique-voter base is under 100. This
 * catches attendance-based capture (small dedicated core voting repeatedly)
 * which the original weight-based rule A misses. See
 * `agent/artifacts/research/capture-cluster-rule-b-proposal.md` for full
 * motivation + threshold-sensitivity notes.
 */
export function isCaptureClusterRuleB(repeatVoteRatio: number, uniqueVoters: number): boolean {
  return repeatVoteRatio > 4 && uniqueVoters < 100;
}

// Minimal ABI covering proposalCount + VoteCast for Bravo-family governors.
// OZ Governor uses the same VoteCast signature.
const GOV_ABI = [
  'function proposalCount() view returns (uint256)',
  'function quorumVotes() view returns (uint256)',
  'function name() view returns (string)',
  // Bravo/OZ Governor VoteCast (uint8 support + votes + reason)
  'event VoteCast(address indexed voter, uint256 proposalId, uint8 support, uint256 votes, string reason)',
];

// GovernorAlpha uses a different VoteCast signature (bool support, no votes/reason).
// Separate ABI so we can scan for both event topics.
const GOV_ALPHA_ABI = [
  'function proposalCount() view returns (uint256)',
  'function quorumVotes() view returns (uint256)',
  'function name() view returns (string)',
  'event VoteCast(address voter, uint256 proposalId, bool support, uint256 votes)',
];

interface AuditParticipationArgs {
  address: string;
  top?: number;
  chain?: number;
  rpc?: string;
  'from-block'?: number;
  'to-block'?: number;
  chunk?: number;
  json?: boolean;
}

export const auditParticipationHandler = {
  builder: (y: Argv) =>
    y
      .option('address', {
        type: 'string',
        demandOption: true,
        describe: 'Governor contract address',
      })
      .option('top', {
        type: 'number',
        default: 10,
        describe: 'Show top N voters by participation frequency',
      })
      .option('chain', {
        type: 'number',
        describe: 'Chain ID (default: POP_DEFAULT_CHAIN or 1)',
      })
      .option('rpc', { type: 'string', describe: 'RPC URL override' })
      .option('from-block', {
        type: 'number',
        describe: 'Start block for VoteCast event scan (default: latest - 500000)',
      })
      .option('to-block', {
        type: 'number',
        describe: 'End block for event scan (default: latest)',
      })
      .option('chunk', {
        type: 'number',
        describe: 'getLogs pagination chunk size (default: chain-aware)',
      })
      .option('json', { type: 'boolean', default: false }),

  handler: async (argv: ArgumentsCamelCase<AuditParticipationArgs>) => {
    try {
      const chainId = argv.chain || parseInt(process.env.POP_DEFAULT_CHAIN || '1', 10);
      const networkConfig = getNetworkByChainId(chainId);
      const rpcUrl = argv.rpc || networkConfig?.rpcUrl || 'https://ethereum.publicnode.com';
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      const contract = new ethers.Contract(argv.address, GOV_ABI, provider);

      // Read metadata
      let govName = 'Unknown';
      let proposalCount = 0;
      let quorumVotes: string | null = null;
      try { govName = await contract.name(); } catch { /* no name() */ }
      try { proposalCount = (await contract.proposalCount()).toNumber(); } catch { /* no proposalCount */ }
      try { quorumVotes = ethers.utils.formatEther(await contract.quorumVotes()); } catch { /* no quorumVotes */ }

      // Determine scan window
      const latestBlock = await provider.getBlockNumber();
      const defaultLookback = 500_000; // ~70 days on Ethereum
      const fromBlock = argv['from-block'] || Math.max(0, latestBlock - defaultLookback);
      const toBlock = argv['to-block'] || latestBlock;
      const defaultChunk = (networkConfig as any)?.defaultLogsChunkBlocks || 10_000;
      const chunk = argv.chunk || defaultChunk;

      // Scan VoteCast events — try Bravo ABI first, then Alpha if 0 results.
      // GovernorAlpha uses VoteCast(address,uint256,bool,uint256) which has a
      // different topic hash than Bravo's VoteCast(address,uint256,uint8,uint256,string).
      output.info('Scanning VoteCast events...');
      const voterFrequency: Record<string, number> = {};
      const proposalVoters: Record<string, Set<string>> = {};
      let totalVoteCasts = 0;
      let chunksScanned = 0;
      let eventFamily = 'bravo';
      const voteCastFilter = contract.filters.VoteCast();

      for (let start = fromBlock; start <= toBlock; start += chunk) {
        const end = Math.min(start + chunk - 1, toBlock);
        try {
          const logs = await contract.queryFilter(voteCastFilter, start, end);
          chunksScanned++;
          for (const log of logs) {
            const voter = String((log.args as any)?.voter || '').toLowerCase();
            const proposalId = String((log.args as any)?.proposalId || '');
            if (voter) {
              voterFrequency[voter] = (voterFrequency[voter] || 0) + 1;
              totalVoteCasts++;
              if (proposalId) {
                if (!proposalVoters[proposalId]) proposalVoters[proposalId] = new Set();
                proposalVoters[proposalId].add(voter);
              }
            }
          }
        } catch {
          // Skip failed chunks (RPC rate limit, range too large)
        }
      }

      // HB#259: If Bravo scan found 0 votes, retry with GovernorAlpha ABI.
      // Alpha's VoteCast(address,uint256,bool,uint256) has a different topic hash.
      if (totalVoteCasts === 0) {
        const alphaContract = new ethers.Contract(argv.address, GOV_ALPHA_ABI, provider);
        const alphaFilter = alphaContract.filters.VoteCast();
        for (let start = fromBlock; start <= toBlock; start += chunk) {
          const end = Math.min(start + chunk - 1, toBlock);
          try {
            const logs = await alphaContract.queryFilter(alphaFilter, start, end);
            chunksScanned++;
            for (const log of logs) {
              const voter = String((log.args as any)?.voter || '').toLowerCase();
              const proposalId = String((log.args as any)?.proposalId || '');
              if (voter) {
                voterFrequency[voter] = (voterFrequency[voter] || 0) + 1;
                totalVoteCasts++;
                if (proposalId) {
                  if (!proposalVoters[proposalId]) proposalVoters[proposalId] = new Set();
                  proposalVoters[proposalId].add(voter);
                }
              }
            }
          } catch {
            // Skip failed chunks
          }
        }
        if (totalVoteCasts > 0) eventFamily = 'alpha';
      }

      const uniqueVoters = Object.keys(voterFrequency).length;
      const proposalsWithVotes = Object.keys(proposalVoters).length;
      const avgVotersPerProposal = proposalsWithVotes > 0
        ? (Object.values(proposalVoters).reduce((sum, s) => sum + s.size, 0) / proposalsWithVotes).toFixed(1)
        : '0';

      // Top voters by frequency
      const topVoters = Object.entries(voterFrequency)
        .sort(([, a], [, b]) => b - a)
        .slice(0, argv.top || 10)
        .map(([addr, count]) => ({
          address: addr,
          voteCount: count,
          participationRate: proposalsWithVotes > 0
            ? `${((count / proposalsWithVotes) * 100).toFixed(1)}%`
            : '0%',
        }));

      // Voter concentration (Gini-like: top-1 share of total votes)
      const topVoterShare = totalVoteCasts > 0 && topVoters.length > 0
        ? ((topVoters[0].voteCount / totalVoteCasts) * 100).toFixed(1) + '%'
        : 'n/a';

      const repeatVoteRatio = computeRepeatVoteRatio(totalVoteCasts, uniqueVoters);
      const captureClusterRuleB = isCaptureClusterRuleB(repeatVoteRatio, uniqueVoters);

      const result = {
        contract: argv.address,
        chain: chainId,
        name: govName,
        proposalCount,
        quorumVotes,
        scanWindow: { fromBlock, toBlock, chunksScanned },
        totalVoteCasts,
        uniqueVoters,
        proposalsWithVotes,
        avgVotersPerProposal: parseFloat(avgVotersPerProposal),
        repeatVoteRatio,
        captureClusterRuleB,
        topVoterShare,
        topVoters,
      };

      if (argv.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        output.info(`\n  Governance Participation — ${govName}`);
        output.info(`  ${'═'.repeat(50)}`);
        output.info(`  Contract:              ${argv.address}`);
        output.info(`  Chain:                 ${chainId}`);
        output.info(`  Proposal count:        ${proposalCount}`);
        if (quorumVotes) output.info(`  Quorum votes:          ${quorumVotes}`);
        output.info(`  Scan window:           blocks ${fromBlock}..${toBlock} (${chunksScanned} chunks)`);
        output.info('');
        output.info(`  Total vote casts:      ${totalVoteCasts}`);
        output.info(`  Unique voters:         ${uniqueVoters}`);
        output.info(`  Proposals with votes:  ${proposalsWithVotes}`);
        output.info(`  Avg voters/proposal:   ${avgVotersPerProposal}`);
        output.info(`  Repeat-vote ratio:     ${repeatVoteRatio}  ${captureClusterRuleB ? '(⚠ rule-B capture: >4 + <100 voters)' : ''}`);
        output.info(`  Top voter share:       ${topVoterShare}`);
        output.info('');
        output.info('  Top voters:');
        for (const v of topVoters) {
          output.info(`    ${v.address}  ${v.voteCount} votes (${v.participationRate})`);
        }
      }
    } catch (err: any) {
      if (argv.json) {
        console.log(JSON.stringify({ status: 'error', message: err.message }));
      } else {
        output.error(err.message);
      }
      process.exitCode = 1;
    }
  },
};
