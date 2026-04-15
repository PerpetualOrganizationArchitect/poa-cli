import type { Argv, ArgumentsCamelCase } from 'yargs';
import { execSync } from 'child_process';
import * as output from '../../lib/output';

interface CompareArgs {
  org: string;
  a: string;
  b: string;
  chain?: number;
}

interface Summary {
  space: string;
  proposals: number;
  avgVotesPerProposal: number;
  uniqueVoters: number;
  gini: number;
  passRate: string;
  topVoterShare: number;
  grade: string;
  topRisks: string[];
}

function computeGrade(gini: number, passRate: number, avgVotes: number, topShare: number): string {
  let score = 100;
  if (gini > 0.9) score -= 30;
  else if (gini > 0.75) score -= 20;
  else if (gini > 0.6) score -= 10;
  if (passRate > 95) score -= 15;
  else if (passRate > 90) score -= 5;
  if (avgVotes < 20) score -= 10;
  if (topShare > 30) score -= 10;
  if (score >= 85) return 'A';
  if (score >= 75) return 'B';
  if (score >= 65) return 'C';
  if (score >= 55) return 'D';
  return 'F';
}

function fetchAudit(space: string, chain?: number): Summary {
  // Reuse audit-snapshot command via child process.
  // Avoids import coupling and matches the exact behavior humans see.
  const cmd = `node ${__dirname}/../../index.js org audit-snapshot --space ${space} --json`;
  const raw = execSync(cmd, { encoding: 'utf8', timeout: 60000 });
  const lines = raw.trim().split('\n');
  const data = JSON.parse(lines[lines.length - 1]);

  if (!data.space) {
    throw new Error(`Failed to audit ${space}: ${data.message || 'unknown error'}`);
  }

  const gini = data.summary?.votingPowerGini ?? 0;
  const passRateStr = data.summary?.passRate ?? '0%';
  const passRate = parseFloat(passRateStr);
  const avgVotes = data.summary?.avgVotesPerProposal ?? 0;
  const topShare = parseFloat((data.topVoters?.[0]?.share ?? '0%').replace('%', ''));

  return {
    space: data.space,
    proposals: data.summary?.proposals ?? 0,
    avgVotesPerProposal: avgVotes,
    uniqueVoters: data.summary?.uniqueVoters ?? 0,
    gini,
    passRate: passRateStr,
    topVoterShare: topShare,
    grade: computeGrade(gini, passRate, avgVotes, topShare),
    topRisks: data.risks ?? [],
  };
}

/**
 * Compare two summaries metric-by-metric. Returns "A", "B", or "tie" per metric.
 * Lower is better for Gini and topVoterShare; higher is better for avgVotes and uniqueVoters.
 * Pass rate sweet spot is 60-85% — too low means dysfunction, too high means rubber stamp.
 */
function compareMetric(name: string, a: number, b: number): { winner: 'A' | 'B' | 'tie'; delta: string } {
  const epsilon = 0.001;
  const diff = Math.abs(a - b);
  let winner: 'A' | 'B' | 'tie' = 'tie';

  if (diff < epsilon) {
    winner = 'tie';
  } else if (name === 'gini' || name === 'topVoterShare') {
    // Lower is better
    winner = a < b ? 'A' : 'B';
  } else if (name === 'passRate') {
    // Sweet spot 60-85%. Within range = best. Outside range: closer to range wins.
    // A 99% pass rate ("rubber stamp") is NOT better than 29% ("meaningful opposition").
    const penalize = (r: number) => {
      if (r >= 60 && r <= 85) return 0;              // in sweet spot, no penalty
      if (r > 85) return r - 85;                      // above range: rubber-stamp
      return 60 - r;                                  // below range: dysfunction
    };
    const aPenalty = penalize(a);
    const bPenalty = penalize(b);
    winner = aPenalty < bPenalty ? 'A' : (aPenalty > bPenalty ? 'B' : 'tie');
  } else {
    // Higher is better (voters, participation)
    winner = a > b ? 'A' : 'B';
  }

  return { winner, delta: diff.toFixed(diff < 1 ? 3 : 1) };
}

export const compareHandler = {
  builder: (yargs: Argv) => yargs
    .option('a', { type: 'string', demandOption: true, describe: 'First Snapshot space (e.g. aave.eth)' })
    .option('b', { type: 'string', demandOption: true, describe: 'Second Snapshot space (e.g. compound.eth)' }),

  handler: async (argv: ArgumentsCamelCase<CompareArgs>) => {
    const spin = output.spinner('Auditing both DAOs...');
    spin.start();

    try {
      spin.text = `Auditing ${argv.a}...`;
      const a = fetchAudit(argv.a as string, argv.chain);
      spin.text = `Auditing ${argv.b}...`;
      const b = fetchAudit(argv.b as string, argv.chain);
      spin.stop();

      const metrics = [
        { name: 'proposals', label: 'Proposals', aVal: a.proposals, bVal: b.proposals },
        { name: 'uniqueVoters', label: 'Unique voters', aVal: a.uniqueVoters, bVal: b.uniqueVoters },
        { name: 'avgVotesPerProposal', label: 'Avg votes/proposal', aVal: a.avgVotesPerProposal, bVal: b.avgVotesPerProposal },
        { name: 'gini', label: 'Gini coefficient', aVal: a.gini, bVal: b.gini },
        { name: 'passRate', label: 'Pass rate %', aVal: parseFloat(a.passRate), bVal: parseFloat(b.passRate) },
        { name: 'topVoterShare', label: 'Top voter share %', aVal: a.topVoterShare, bVal: b.topVoterShare },
      ];

      const comparisons = metrics.map(m => ({
        ...m,
        ...compareMetric(m.name, m.aVal, m.bVal),
      }));

      const aWins = comparisons.filter(c => c.winner === 'A').length;
      const bWins = comparisons.filter(c => c.winner === 'B').length;
      const overall = aWins > bWins ? a.space : bWins > aWins ? b.space : 'tie';

      const result = {
        a,
        b,
        comparisons: comparisons.map(c => ({
          metric: c.name,
          label: c.label,
          a: c.aVal,
          b: c.bVal,
          winner: c.winner,
          delta: c.delta,
        })),
        summary: {
          aWins,
          bWins,
          overall,
          note: `${a.space} ${a.grade} vs ${b.space} ${b.grade}`,
        },
      };

      if (argv.json) {
        output.json(result);
      } else {
        console.log('');
        console.log(`  DAO Governance Comparison`);
        console.log('  ' + '═'.repeat(60));
        console.log(`  A: ${a.space.padEnd(24)} Grade ${a.grade}`);
        console.log(`  B: ${b.space.padEnd(24)} Grade ${b.grade}`);
        console.log('');
        console.log(`  ${'Metric'.padEnd(22)} ${a.space.slice(0, 12).padEnd(14)} ${b.space.slice(0, 12).padEnd(14)} Winner`);
        console.log('  ' + '─'.repeat(60));
        for (const c of comparisons) {
          const aStr = typeof c.aVal === 'number' ? (c.aVal < 10 ? c.aVal.toFixed(3) : c.aVal.toString()) : c.aVal;
          const bStr = typeof c.bVal === 'number' ? (c.bVal < 10 ? c.bVal.toFixed(3) : c.bVal.toString()) : c.bVal;
          const winnerStr = c.winner === 'A' ? 'A ✓' : c.winner === 'B' ? 'B ✓' : 'tie';
          console.log(`  ${c.label.padEnd(22)} ${String(aStr).padEnd(14)} ${String(bStr).padEnd(14)} ${winnerStr}`);
        }
        console.log('');
        console.log(`  Overall: ${overall} wins (${aWins}-${bWins})`);
        console.log('');
        if (a.topRisks.length > 0) {
          console.log(`  ${a.space} risks:`);
          a.topRisks.slice(0, 3).forEach(r => console.log(`    - ${r}`));
          console.log('');
        }
        if (b.topRisks.length > 0) {
          console.log(`  ${b.space} risks:`);
          b.topRisks.slice(0, 3).forEach(r => console.log(`    - ${r}`));
          console.log('');
        }
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
