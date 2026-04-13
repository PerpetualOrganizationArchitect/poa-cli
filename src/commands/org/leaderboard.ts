import type { Argv, ArgumentsCamelCase } from 'yargs';
import * as output from '../../lib/output';

interface LeaderboardArgs {
  spaces: string;
  pin?: boolean;
  chain?: number;
}

interface DaoScore {
  dao: string;
  space: string;
  score: number;
  grade: string;
  gini: number;
  avgVotes: number;
  uniqueVoters: number;
  passRate: string;
  topVoterShare: string;
  proposals: number;
}

function computeScore(summary: any): number {
  let score = 100;
  const gini = summary.votingPowerGini || 0;
  if (gini > 0.95) score -= 45;
  else if (gini > 0.9) score -= 35;
  else if (gini > 0.8) score -= 25;
  else if (gini > 0.7) score -= 15;
  else if (gini > 0.5) score -= 5;

  const avgVotes = summary.avgVotesPerProposal || 0;
  if (avgVotes < 10) score -= 20;
  else if (avgVotes < 50) score -= 10;
  else if (avgVotes > 200) score += 5;

  const passRate = parseInt(summary.passRate || '0');
  if (passRate > 95) score -= 15;
  else if (passRate > 90) score -= 5;
  else if (passRate < 70) score += 5;

  const topShare = summary.topVoterShare || 0;
  if (topShare > 50) score -= 15;
  else if (topShare > 30) score -= 5;

  return Math.max(0, Math.min(100, score));
}

function gradeFromScore(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B+';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C+';
  if (score >= 50) return 'C';
  if (score >= 40) return 'D+';
  if (score >= 30) return 'D';
  if (score >= 20) return 'D-';
  return 'F';
}

export const leaderboardHandler = {
  builder: (yargs: Argv) => yargs
    .option('spaces', { type: 'string', demandOption: true, describe: 'Comma-separated Snapshot space IDs (e.g. aave.eth,comp-vote.eth)' })
    .option('pin', { type: 'boolean', default: false, describe: 'Pin leaderboard to IPFS' }),

  handler: async (argv: ArgumentsCamelCase<LeaderboardArgs>) => {
    const spaces = (argv.spaces as string).split(',').map(s => s.trim()).filter(Boolean);
    if (spaces.length === 0) {
      output.error('Provide at least one Snapshot space');
      process.exit(1);
    }

    const spin = output.spinner(`Auditing ${spaces.length} DAOs...`);
    spin.start();

    const { execSync } = require('child_process');
    const results: DaoScore[] = [];

    for (const space of spaces) {
      spin.text = `Auditing ${space}...`;
      try {
        const raw = execSync(
          `node ${__dirname}/../../index.js org audit-snapshot --space ${space} --json`,
          { encoding: 'utf8', timeout: 60000, env: process.env }
        );
        const lines = raw.trim().split('\n');
        const data = JSON.parse(lines[lines.length - 1]);

        if (data.status === 'error') {
          continue;
        }

        const topShare = data.topVoters?.[0]?.share || '0%';
        const summary = { ...data.summary, topVoterShare: parseFloat(topShare) };
        const score = computeScore(summary);

        results.push({
          dao: space.replace('.eth', ''),
          space,
          score,
          grade: gradeFromScore(score),
          gini: data.summary?.votingPowerGini || 0,
          avgVotes: data.summary?.avgVotesPerProposal || 0,
          uniqueVoters: data.summary?.uniqueVoters || 0,
          passRate: data.summary?.passRate || '0%',
          topVoterShare: topShare,
          proposals: data.summary?.proposals || 0,
        });
      } catch {
        // skip failed audits
      }
    }

    results.sort((a, b) => b.score - a.score);
    results.forEach((r, i) => r.dao = `#${i + 1} ${r.dao}`);

    spin.stop();

    const report: any = {
      title: 'DeFi Governance Health Leaderboard',
      auditor: 'Argus',
      date: new Date().toISOString().split('T')[0],
      daosAudited: results.length,
      rankings: results,
      avgGini: +(results.reduce((s, r) => s + r.gini, 0) / results.length).toFixed(3),
    };

    if (argv.pin) {
      const { pinJson } = require('../../lib/ipfs');
      report.ipfsCid = await pinJson(JSON.stringify(report));
    }

    if (argv.json) {
      output.json(report);
    } else {
      console.log('');
      console.log('  DeFi Governance Health Leaderboard');
      console.log('  ' + '═'.repeat(60));
      console.log('');
      for (const r of results) {
        const bar = '█'.repeat(Math.round(r.score / 5)) + '░'.repeat(20 - Math.round(r.score / 5));
        console.log(`  ${r.dao.padEnd(25)} ${r.grade.padEnd(3)} ${bar} ${r.score}/100`);
        console.log(`  ${''.padEnd(25)} Gini ${r.gini.toFixed(2)} | ${r.avgVotes} avg votes | ${r.passRate} pass | Top: ${r.topVoterShare}`);
        console.log('');
      }
      console.log(`  Average Gini: ${report.avgGini}`);
      console.log(`  Audited: ${results.length} DAOs`);
      if (report.ipfsCid) console.log(`  IPFS: https://ipfs.io/ipfs/${report.ipfsCid}`);
      console.log('');
    }
  },
};
