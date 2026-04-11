import type { Argv, ArgumentsCamelCase } from 'yargs';
import * as output from '../../lib/output';

const SNAPSHOT_API = 'https://hub.snapshot.org/graphql';

interface AuditSnapshotArgs {
  org: string;
  space: string;
  pin?: boolean;
  chain?: number;
  rpc?: string;
}

async function querySnapshot(query: string, variables: any = {}): Promise<any> {
  const response = await fetch(SNAPSHOT_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const json = await response.json() as any;
  if (json.errors) throw new Error(`Snapshot API: ${json.errors[0].message}`);
  return json.data;
}

export const auditSnapshotHandler = {
  builder: (yargs: Argv) => yargs
    .option('space', { type: 'string', demandOption: true, describe: 'Snapshot space ID (e.g. ens.eth)' })
    .option('pin', { type: 'boolean', default: false, describe: 'Pin report to IPFS' }),

  handler: async (argv: ArgumentsCamelCase<AuditSnapshotArgs>) => {
    const spin = output.spinner(`Auditing Snapshot space: ${argv.space}...`);
    spin.start();

    try {
      const spaceId = argv.space as string;

      // Fetch proposals (last 100)
      spin.text = 'Fetching proposals...';
      const proposalData = await querySnapshot(`
        query($space: String!) {
          proposals(where: {space: $space}, first: 100, orderBy: "created", orderDirection: desc) {
            id title state votes scores_total scores choices created end author
          }
        }
      `, { space: spaceId });

      const proposals = proposalData.proposals || [];
      if (proposals.length === 0) throw new Error(`No proposals found for space "${spaceId}"`);

      // Fetch votes for recent proposals (last 10)
      spin.text = 'Analyzing voting patterns...';
      const recentProposalIds = proposals.slice(0, 10).map((p: any) => p.id);
      const voteData = await querySnapshot(`
        query($proposals: [String!]!) {
          votes(where: {proposal_in: $proposals}, first: 1000, orderBy: "vp", orderDirection: desc) {
            voter vp proposal { id }
          }
        }
      `, { proposals: recentProposalIds });

      const votes = voteData.votes || [];

      // Compute metrics
      const closed = proposals.filter((p: any) => p.state === 'closed');
      const active = proposals.filter((p: any) => p.state === 'active');
      const totalVotes = proposals.reduce((sum: number, p: any) => sum + (p.votes || 0), 0);
      const avgVotesPerProposal = closed.length > 0 ? Math.round(totalVotes / closed.length) : 0;

      // Voter concentration
      const voterPower: Record<string, number> = {};
      for (const v of votes) {
        voterPower[v.voter] = (voterPower[v.voter] || 0) + (v.vp || 0);
      }
      const sortedVoters = Object.entries(voterPower).sort((a, b) => b[1] - a[1]);
      const totalVP = sortedVoters.reduce((sum, [, vp]) => sum + vp, 0);
      const uniqueVoters = sortedVoters.length;

      // Top 5 voters
      const topVoters = sortedVoters.slice(0, 5).map(([addr, vp]) => ({
        address: addr.slice(0, 8) + '...' + addr.slice(-4),
        votingPower: Math.round(vp),
        share: totalVP > 0 ? ((vp / totalVP) * 100).toFixed(1) + '%' : '0%',
      }));

      // Voter Gini
      const vpValues = sortedVoters.map(([, vp]) => vp).sort((a, b) => a - b);
      let gini = 0;
      if (vpValues.length > 1 && totalVP > 0) {
        let sumDiffs = 0;
        for (let i = 0; i < vpValues.length; i++) {
          for (let j = 0; j < vpValues.length; j++) {
            sumDiffs += Math.abs(vpValues[i] - vpValues[j]);
          }
        }
        gini = sumDiffs / (2 * vpValues.length * totalVP);
      }

      // Proposal pass rate (approximation: option with highest score wins)
      const passedCount = closed.filter((p: any) => {
        if (!p.scores || p.scores.length < 2) return true;
        return p.scores[0] > p.scores[1]; // First option ("For") wins
      }).length;

      // Time span
      const oldestProposal = proposals[proposals.length - 1];
      const newestProposal = proposals[0];
      const timeSpanDays = oldestProposal ? Math.round((newestProposal.created - oldestProposal.created) / 86400) : 0;

      // Risks
      const risks: string[] = [];
      if (gini > 0.8) risks.push(`Extreme voting power concentration (Gini: ${gini.toFixed(2)})`);
      else if (gini > 0.6) risks.push(`High voting power concentration (Gini: ${gini.toFixed(2)})`);
      if (topVoters.length > 0 && parseFloat(topVoters[0].share) > 30) {
        risks.push(`Top voter controls ${topVoters[0].share} of voting power`);
      }
      if (avgVotesPerProposal < 20) risks.push(`Low voter participation (avg ${avgVotesPerProposal} votes/proposal)`);
      if (passedCount / Math.max(closed.length, 1) > 0.95) risks.push('Near-100% pass rate — proposals may lack genuine deliberation');
      if (uniqueVoters < 10) risks.push(`Very few unique voters (${uniqueVoters}) — governance capture risk`);

      // Recommendations
      const recommendations: string[] = [];
      if (gini > 0.6) recommendations.push('Implement delegation programs to distribute voting power');
      if (avgVotesPerProposal < 20) recommendations.push('Lower barriers to participation — simplify voting UX');
      if (passedCount / Math.max(closed.length, 1) > 0.95) recommendations.push('Encourage more diverse proposals and dissenting views');
      if (uniqueVoters < 20) recommendations.push('Launch voter education and incentive programs');

      const report: any = {
        space: spaceId,
        auditor: 'Argus',
        date: new Date().toISOString().split('T')[0],
        summary: {
          proposals: proposals.length,
          active: active.length,
          closed: closed.length,
          totalVotes,
          avgVotesPerProposal,
          uniqueVoters,
          votingPowerGini: parseFloat(gini.toFixed(3)),
          passRate: closed.length > 0 ? `${Math.round((passedCount / closed.length) * 100)}%` : 'N/A',
          timeSpanDays,
        },
        topVoters,
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
        output.success(`Snapshot Audit: ${spaceId}`, {
          proposals: `${proposals.length} (${active.length} active, ${closed.length} closed)`,
          avgVotes: avgVotesPerProposal,
          uniqueVoters,
          vpGini: gini.toFixed(3),
          passRate: report.summary.passRate,
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
