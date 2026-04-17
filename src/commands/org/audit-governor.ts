import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import { resolveNetworkConfig } from '../../config/networks';
import * as output from '../../lib/output';

// Standard Governor ABI fragments
const GOVERNOR_ABI = [
  'function proposalCount() view returns (uint256)',
  'function quorum(uint256 blockNumber) view returns (uint256)',
  'function votingDelay() view returns (uint256)',
  'function votingPeriod() view returns (uint256)',
  'function name() view returns (string)',
  'event ProposalCreated(uint256 proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 startBlock, uint256 endBlock, string description)',
  'event VoteCast(address indexed voter, uint256 proposalId, uint8 support, uint256 weight, string reason)',
  'event ProposalExecuted(uint256 proposalId)',
  'event ProposalCanceled(uint256 proposalId)',
];

interface AuditGovernorArgs {
  org: string;
  address: string;
  chain?: number;
  blocks?: number;
  fromBlock?: number;
  toBlock?: number;
  pin?: boolean;
  rpc?: string;
}

export const auditGovernorHandler = {
  builder: (yargs: Argv) => yargs
    .option('address', { type: 'string', demandOption: true, describe: 'Governor contract address' })
    .option('blocks', { type: 'number', default: 500000, describe: 'Number of blocks to scan back from head (ignored if --from-block is set)' })
    .option('from-block', { type: 'number', describe: 'Explicit start block (overrides --blocks). Useful on high-throughput L2s where "last N blocks" is a short time window.' })
    .option('to-block', { type: 'number', describe: 'Explicit end block (defaults to current head). Pair with --from-block for a specific historical range.' })
    .option('pin', { type: 'boolean', default: false, describe: 'Pin report to IPFS' }),

  handler: async (argv: ArgumentsCamelCase<AuditGovernorArgs>) => {
    const spin = output.spinner(`Auditing Governor: ${argv.address}...`);
    spin.start();

    try {
      const chainId = argv.chain || 1;
      let rpcUrl = argv.rpc as string;
      if (!rpcUrl) {
        try {
          const config = resolveNetworkConfig(chainId);
          rpcUrl = config.resolvedRpc;
        } catch {
          // Fallback RPCs for chains not in our config
          const fallbackRpcs: Record<number, string> = {
            1: 'https://ethereum-rpc.publicnode.com',
            10: 'https://mainnet.optimism.io',
            137: 'https://polygon-rpc.com',
            8453: 'https://mainnet.base.org',
          };
          rpcUrl = fallbackRpcs[chainId];
          if (!rpcUrl) throw new Error(`No RPC for chain ${chainId}. Pass --rpc <url>.`);
        }
      }
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl, chainId);
      const governor = new ethers.Contract(argv.address as string, GOVERNOR_ABI, provider);

      // Read contract config
      spin.text = 'Reading governor config...';
      let governorName = '';
      let votingDelay = 0;
      let votingPeriod = 0;

      try { governorName = await governor.name(); } catch { governorName = 'Unknown Governor'; }
      try { votingDelay = (await governor.votingDelay()).toNumber(); } catch {}
      try { votingPeriod = (await governor.votingPeriod()).toNumber(); } catch {}

      // Fetch events — chunk into smaller ranges to avoid RPC block limits (50K for public RPCs)
      spin.text = 'Scanning proposal events...';
      const currentBlock = await provider.getBlockNumber();
      // Range resolution: --from-block/--to-block override the relative --blocks window.
      // Rationale: high-throughput L2s (Arbitrum ~0.25s/block) make "last N blocks" a short
      // wall-clock window where governor proposals may not have occurred. Callers who know
      // when a DAO was active can point an explicit range. Added for task #467 (HB#570).
      const toBlock = argv.toBlock !== undefined
        ? Math.min(argv.toBlock as number, currentBlock)
        : currentBlock;
      const fromBlock = argv.fromBlock !== undefined
        ? Math.max(0, argv.fromBlock as number)
        : Math.max(0, toBlock - (argv.blocks as number));
      if (fromBlock > toBlock) {
        throw new Error(`--from-block (${fromBlock}) must be <= --to-block (${toBlock}).`);
      }
      const MAX_RANGE = 49_000; // stay under common 50K block limit

      async function chunkedQuery(filter: any, from: number, to: number): Promise<any[]> {
        const results: any[] = [];
        for (let start = from; start < to; start += MAX_RANGE) {
          const end = Math.min(start + MAX_RANGE - 1, to);
          try {
            const events = await governor.queryFilter(filter, start, end);
            results.push(...events);
          } catch {
            // If a chunk fails, skip it and continue
          }
        }
        return results;
      }

      const [createdEvents, executedEvents, canceledEvents, voteEvents] = await Promise.all([
        chunkedQuery(governor.filters.ProposalCreated(), fromBlock, toBlock),
        chunkedQuery(governor.filters.ProposalExecuted(), fromBlock, toBlock),
        chunkedQuery(governor.filters.ProposalCanceled(), fromBlock, toBlock),
        chunkedQuery(governor.filters.VoteCast(), fromBlock, toBlock),
      ]);

      const totalProposals = createdEvents.length;
      const executedCount = executedEvents.length;
      const canceledCount = canceledEvents.length;
      const passRate = totalProposals > 0 ? Math.round((executedCount / totalProposals) * 100) : 0;

      // Voter analysis
      spin.text = 'Analyzing voting patterns...';
      const voterPower: Record<string, bigint> = {};
      const voterCount: Record<string, number> = {};
      const supportTally = { for: 0, against: 0, abstain: 0 };

      for (const ev of voteEvents) {
        const voter = ev.args!.voter;
        const weight = BigInt(ev.args!.weight.toString());
        const support = ev.args!.support;

        voterPower[voter] = (voterPower[voter] || 0n) + weight;
        voterCount[voter] = (voterCount[voter] || 0) + 1;

        if (support === 1) supportTally.for++;
        else if (support === 0) supportTally.against++;
        else supportTally.abstain++;
      }

      const uniqueVoters = Object.keys(voterPower).length;
      const totalVotes = voteEvents.length;
      const avgVotesPerProposal = totalProposals > 0 ? Math.round(totalVotes / totalProposals) : 0;

      // Voting power Gini
      const powers = Object.values(voterPower).sort((a, b) => Number(a - b));
      const totalPower = powers.reduce((sum, p) => sum + p, 0n);
      let gini = 0;
      if (powers.length > 1 && totalPower > 0n) {
        let sumDiffs = 0n;
        for (let i = 0; i < powers.length; i++) {
          for (let j = 0; j < powers.length; j++) {
            const diff = powers[i] > powers[j] ? powers[i] - powers[j] : powers[j] - powers[i];
            sumDiffs += diff;
          }
        }
        gini = Number(sumDiffs) / (2 * powers.length * Number(totalPower));
      }

      // Top voters
      const sortedVoters = Object.entries(voterPower)
        .sort((a, b) => Number(b[1] - a[1]))
        .slice(0, 5)
        .map(([addr, power]) => ({
          address: addr.slice(0, 8) + '...' + addr.slice(-4),
          votingPower: Number(power),
          votes: voterCount[addr] || 0,
          share: totalPower > 0n ? ((Number(power) / Number(totalPower)) * 100).toFixed(1) + '%' : '0%',
        }));

      // Risks
      const risks: string[] = [];
      if (gini > 0.8) risks.push(`Extreme voting power concentration (Gini: ${gini.toFixed(2)})`);
      else if (gini > 0.6) risks.push(`High voting power concentration (Gini: ${gini.toFixed(2)})`);
      if (sortedVoters.length > 0 && parseFloat(sortedVoters[0].share) > 30) {
        risks.push(`Top voter controls ${sortedVoters[0].share} of voting power`);
      }
      if (avgVotesPerProposal < 20) risks.push(`Low voter participation (avg ${avgVotesPerProposal} votes/proposal)`);
      if (passRate > 95 && totalProposals > 5) risks.push('Near-100% pass rate — proposals may lack deliberation');
      if (canceledCount > totalProposals * 0.3) risks.push(`High cancellation rate (${canceledCount}/${totalProposals})`);

      const recommendations: string[] = [];
      if (gini > 0.6) recommendations.push('Consider delegation incentives to distribute voting power');
      if (avgVotesPerProposal < 20) recommendations.push('Lower participation barriers — simplify voting UX');
      if (canceledCount > 0) recommendations.push('Review why proposals are being canceled before vote completion');

      const report: any = {
        governor: argv.address,
        name: governorName,
        chain: `Chain ${chainId}`,
        auditor: 'Argus',
        date: new Date().toISOString().split('T')[0],
        summary: {
          proposals: totalProposals,
          executed: executedCount,
          canceled: canceledCount,
          passRate: `${passRate}%`,
          totalVotes,
          avgVotesPerProposal,
          uniqueVoters,
          votingPowerGini: parseFloat(gini.toFixed(3)),
          votingDelay: `${votingDelay} blocks`,
          votingPeriod: `${votingPeriod} blocks`,
          supportBreakdown: supportTally,
        },
        topVoters: sortedVoters,
        risks,
        recommendations,
      };

      if (argv.pin) {
        const { pinJson } = require('../../lib/ipfs');
        const cid = await pinJson(JSON.stringify(report));
        report.ipfsCid = cid;
      }

      spin.stop();

      if (argv.json) {
        output.json(report);
      } else {
        output.success(`Governor Audit: ${governorName}`, {
          proposals: `${totalProposals} (${executedCount} executed, ${canceledCount} canceled)`,
          passRate: `${passRate}%`,
          avgVotes: avgVotesPerProposal,
          uniqueVoters,
          vpGini: gini.toFixed(3),
          risks: risks.join('; ') || 'None identified',
        });
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
