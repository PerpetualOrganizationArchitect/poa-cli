import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import { resolveNetworkConfig } from '../../config/networks';
import { resolveOrgModules } from '../../lib/resolve';
import * as output from '../../lib/output';

interface AnalyzeArgs {
  org: string;
  chain: number;
  proposal: number;
  rpc?: string;
}

export const analyzeHandler = {
  builder: (yargs: Argv) => yargs
    .option('proposal', { type: 'number', demandOption: true, describe: 'Proposal ID to analyze' }),

  handler: async (argv: ArgumentsCamelCase<AnalyzeArgs>) => {
    const spin = output.spinner('Analyzing vote...');
    spin.start();

    try {
      const chainId = argv.chain as number || 100;
      const networkConfig = resolveNetworkConfig(chainId);
      const provider = new ethers.providers.JsonRpcProvider(networkConfig.resolvedRpc);
      const contracts = await resolveOrgModules(argv.org as string, chainId);
      const hvAddr = contracts.hybridVotingAddress;
      if (!hvAddr) throw new Error('HybridVoting not found for this org');

      const abi = require('../../abi/HybridVotingNew.json');
      const hv = new ethers.Contract(hvAddr, abi, provider);
      const proposalId = argv.proposal as number;

      // Get class config
      spin.text = 'Reading class config...';
      const classes = await hv.getProposalClasses(proposalId);
      const classConfig = classes.map((c: any) => ({
        slicePct: Number(c.slicePct),
        quadratic: c.quadratic,
      }));

      // Get VoteCast events
      spin.text = 'Reading vote events...';
      const filter = hv.filters.VoteCast(proposalId);
      const events = await hv.queryFilter(filter, -200000);
      if (events.length === 0) throw new Error('No votes found for proposal ' + proposalId);

      // Get PT balance for each voter
      spin.text = 'Reading PT balances...';
      const ptAddr = contracts.participationTokenAddress;
      if (!ptAddr) throw new Error('ParticipationToken not found for this org');
      const ptAbi = ['function balanceOf(address) view returns (uint256)'];
      const pt = new ethers.Contract(ptAddr, ptAbi, provider);

      // Resolve usernames
      const { queryAllChains } = require('../../lib/subgraph');
      const orgId = contracts.orgId || argv.org;
      const memberQuery = `{ organization(id: "${orgId}") { users(first: 100) { address account { username } } } }`;
      const memberResults = await queryAllChains(memberQuery, {});
      const usernames: Record<string, string> = {};
      for (const r of memberResults) {
        for (const u of r.data?.organization?.users || []) {
          if (u.account?.username) usernames[u.address.toLowerCase()] = u.account.username;
        }
      }

      const voters: any[] = [];
      for (const ev of events) {
        const addr = ev.args!.voter;
        const weights = ev.args!.weights.map((w: any) => Number(w));
        const classRawPowers = ev.args!.classRawPowers.map((p: any) => BigInt(p.toString()));
        const ptBal = await pt.balanceOf(addr);
        voters.push({
          address: addr,
          name: usernames[addr.toLowerCase()] || addr.slice(0, 10),
          weights,
          classRawPowers,
          ptBalance: parseFloat(ethers.utils.formatEther(ptBal)),
        });
      }

      const numOptions = voters[0].weights.length;

      // Compute effective power per option
      function computeResult(voteData: any[], slices: number[]) {
        const totals: bigint[] = new Array(numOptions).fill(0n);
        for (let opt = 0; opt < numOptions; opt++) {
          for (const v of voteData) {
            for (let cls = 0; cls < slices.length; cls++) {
              totals[opt] += BigInt(v.weights[opt]) * v.classRawPowers[cls] * BigInt(slices[cls]);
            }
          }
        }
        const total = totals.reduce((a, b) => a + b, 0n);
        return totals.map(t => total > 0n ? Number(t * 10000n / total) / 100 : 0);
      }

      spin.text = 'Computing scenarios...';

      // Actual result
      const actualSlices = classConfig.map((c: any) => c.slicePct);
      const actual = computeResult(voters, actualSlices);

      // DD-only
      const ddOnlySlices = classConfig.map((_: any, i: number) => i === 0 ? 100 : 0);
      const ddOnly = computeResult(voters, ddOnlySlices);

      // Token-only
      const tokenOnlySlices = classConfig.map((_: any, i: number) => i === 1 ? 100 : 0);
      const tokenOnly = computeResult(voters, tokenOnlySlices);

      // No quadratic (use linear PT as token power)
      const linearVoters = voters.map(v => ({
        ...v,
        classRawPowers: [v.classRawPowers[0], BigInt(Math.round(v.ptBalance)) * BigInt('1000000000000000000')],
      }));
      const noQuadratic = computeResult(linearVoters, actualSlices);

      // Single-pick (each voter's max weight gets 100, rest 0)
      const singleVoters = voters.map(v => {
        const maxW = Math.max(...v.weights);
        const maxIdx = v.weights.indexOf(maxW);
        const single = new Array(numOptions).fill(0);
        single[maxIdx] = 100;
        return { ...v, weights: single };
      });
      const singlePick = computeResult(singleVoters, actualSlices);

      spin.stop();

      // Build rankings
      const makeRanking = (pcts: number[]) =>
        pcts.map((pct, i) => ({ option: i, pct })).sort((a, b) => b.pct - a.pct);

      const report: any = {
        proposalId,
        voters: voters.length,
        options: numOptions,
        classConfig,
        votes: voters.map(v => ({
          name: v.name,
          weights: v.weights,
          ptBalance: v.ptBalance,
          ddPower: v.classRawPowers[0].toString(),
          tokenPower: v.classRawPowers[1].toString(),
        })),
        actual: { ranking: makeRanking(actual), winner: makeRanking(actual)[0] },
        counterfactuals: {
          ddOnly: { ranking: makeRanking(ddOnly), winner: makeRanking(ddOnly)[0], changed: makeRanking(ddOnly)[0].option !== makeRanking(actual)[0].option },
          tokenOnly: { ranking: makeRanking(tokenOnly), winner: makeRanking(tokenOnly)[0], changed: makeRanking(tokenOnly)[0].option !== makeRanking(actual)[0].option },
          noQuadratic: { ranking: makeRanking(noQuadratic), winner: makeRanking(noQuadratic)[0], changed: makeRanking(noQuadratic)[0].option !== makeRanking(actual)[0].option },
          singlePick: { ranking: makeRanking(singlePick), winner: makeRanking(singlePick)[0], changed: makeRanking(singlePick)[0].option !== makeRanking(actual)[0].option },
        },
        robustness: (makeRanking(ddOnly)[0].option === makeRanking(actual)[0].option &&
          makeRanking(tokenOnly)[0].option === makeRanking(actual)[0].option) ? 'ROBUST' : 'SENSITIVE',
      };

      if (argv.json) {
        output.json(report);
      } else {
        console.log('');
        console.log(`  Vote Analysis: Proposal #${proposalId}`);
        console.log('  ' + '═'.repeat(55));
        console.log(`  Classes: ${classConfig.map((c: any, i: number) => `${i === 0 ? 'DD' : 'Token'} ${c.slicePct}%${c.quadratic ? ' (quadratic)' : ''}`).join(' | ')}`);
        console.log(`  Voters: ${voters.length}`);
        console.log('');

        // Show votes
        for (const v of report.votes) {
          console.log(`  ${v.name}: weights [${v.weights.join(',')}] | ${v.ptBalance} PT`);
        }
        console.log('');

        // Actual ranking
        console.log('  ACTUAL RESULT:');
        for (const r of report.actual.ranking) {
          const bar = '█'.repeat(Math.round(r.pct / 3)) + '░'.repeat(Math.max(0, 33 - Math.round(r.pct / 3)));
          console.log(`    Option ${r.option}: ${bar} ${r.pct.toFixed(1)}%`);
        }
        console.log('');

        // Counterfactuals
        const scenarios = [
          ['DD Only', report.counterfactuals.ddOnly],
          ['Token Only', report.counterfactuals.tokenOnly],
          ['No Quadratic', report.counterfactuals.noQuadratic],
          ['Single Pick', report.counterfactuals.singlePick],
        ];
        console.log('  COUNTERFACTUALS:');
        for (const [name, s] of scenarios) {
          const winner = (s as any).winner;
          const changed = (s as any).changed ? ' ← DIFFERENT!' : '';
          console.log(`    ${(name as string).padEnd(14)} Winner: Option ${winner.option} (${winner.pct.toFixed(1)}%)${changed}`);
        }
        console.log('');
        console.log(`  Robustness: ${report.robustness}`);
        console.log('');
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
