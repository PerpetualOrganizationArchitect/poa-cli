/**
 * pop org compare-time-window — re-audit a stored AUDIT_DB entry and
 * report drift against the stored snapshot.
 *
 * This command codifies the asymmetric-drift research finding from
 * brain lesson `dao-governance-gini-drifts-asymmetrically-...` (HB#296)
 * and the stored-data-stale rule from
 * `stored-audit-data-has-a-half-life-of-months-re-probe-every-20-30-hbs`
 * (HB#293) into an executable check. Codification rationale per
 * brain lesson `lessons-to-tools-knowledge-pipeline-codify-a-brain-lesson-...`
 * (HB#314): a brain lesson should be promoted to CLI when it reappears
 * 3+ times. Asymmetric drift has been observed in 11 of 12 refreshes
 * and the stored-stale rule in 5 of 5 cases — both well past the
 * promotion threshold.
 *
 * Usage:
 *   pop org compare-time-window --space aavedao.eth
 *
 * Output: a single drift summary line + JSON shape with the new vs
 * stored numbers and a categorical drift label (worse / stable /
 * better-noise / better). Threshold for "stable" is ±0.01 absolute Gini
 * (slightly above the Aavegotchi noise floor of 0.003 from HB#298).
 *
 * Scope deliberately narrow:
 * - Looks up the entry in the same hardcoded AUDIT_DB used by
 *   portfolio.ts. (TODO future: extract AUDIT_DB to its own module
 *   so this command and portfolio share the source.)
 * - Shells out to `pop org audit-snapshot --space X --json` to get
 *   fresh data, rather than re-implementing the snapshot query.
 *   Avoids a partial duplicate of audit-snapshot's Gini math.
 * - Does NOT update the stored entry — that's a separate explicit
 *   action by the operator (preserves git history vs silent overwrites).
 */

import type { Argv, ArgumentsCamelCase } from 'yargs';
import { execFileSync } from 'child_process';
import * as output from '../../lib/output';

interface CompareTimeWindowArgs {
  space?: string;
  threshold?: number;
  all?: boolean;
}

// Inline copy of the same AUDIT_DB structure portfolio.ts uses.
// Lookups are by space-id mapping below; the canonical store is
// portfolio.ts. This command resolves space → name → stored entry.
//
// space → display name mapping — needed because audit-snapshot uses
// space ids like 'aavedao.eth' while AUDIT_DB keys on display names
// like 'Aave'. Future refactor: store the space id ON the AUDIT_DB row.
const SPACE_TO_NAME: Record<string, string> = {
  'aavedao.eth': 'Aave',
  'comp-vote.eth': 'Compound',
  'frax.eth': 'Frax',
  'cvx.eth': 'Convex',
  'gitcoindao.eth': 'Gitcoin',
  'olympusdao.eth': 'Olympus',
  'lido-snapshot.eth': 'Lido',
  'arbitrumfoundation.eth': 'Arbitrum',
  'opcollective.eth': 'Optimism Collective',
  'nouns.eth': 'Nouns',
  'sismo.eth': 'Sismo',
  'aavegotchi.eth': 'Aavegotchi',
  'loopringdao.eth': 'Loopring',
  'cakevote.eth': 'PancakeSwap',
  'badgerdao.eth': 'BadgerDAO',
  'venus-xvs.eth': 'Venus',
  'dydxgov.eth': 'dYdX',
  'shutterdao0x36.eth': 'Shutter',
  'gmx.eth': 'GMX',
  'stgdao.eth': 'Stargate',
  'radiantcapital.eth': 'Radiant Capital',
  'snxgov.eth': 'Synthetix Council',
  'hop.eth': 'Hop',
  'yearn': 'Yearn',
  'sushigov.eth': 'Sushi',
  'snapshot.dcl.eth': 'Decentraland',
  'klimadao.eth': 'KlimaDAO',
  'banklessvault.eth': 'Bankless',
  'curve.eth': 'Curve',
};

function classifyDrift(deltaGini: number, threshold: number): 'worse' | 'better' | 'stable' {
  if (deltaGini > threshold) return 'worse';
  if (deltaGini < -threshold) return 'better';
  return 'stable';
}

/**
 * Compare a single space against its stored AUDIT_DB row.
 * Returns the structured result; callers are responsible for printing.
 */
async function compareOneSpace(
  space: string,
  threshold: number,
): Promise<{ ok: true; result: any } | { ok: false; error: string }> {
  const name = SPACE_TO_NAME[space];
  if (!name) {
    return { ok: false, error: `Space "${space}" not in SPACE_TO_NAME mapping` };
  }

  let storedRow: any;
  try {
    const portfolioOut = execFileSync(
      process.execPath,
      [process.argv[1], 'org', 'portfolio', '--json'],
      { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] },
    );
    const portfolio = JSON.parse(portfolioOut);
    const rows: any[] = portfolio.rows ?? [];
    storedRow = rows.find(r => r.name === name);
    if (!storedRow) {
      return { ok: false, error: `Space "${space}" maps to "${name}" but no AUDIT_DB row` };
    }
  } catch (err: any) {
    return { ok: false, error: `Portfolio read failed: ${err.message}` };
  }

  let freshRaw: any;
  try {
    const auditOut = execFileSync(
      process.execPath,
      [process.argv[1], 'org', 'audit-snapshot', '--space', space, '--json'],
      { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] },
    );
    freshRaw = JSON.parse(auditOut);
    if (freshRaw.status === 'error') {
      return { ok: false, error: `audit-snapshot: ${freshRaw.message}` };
    }
  } catch (err: any) {
    return { ok: false, error: `audit-snapshot failed: ${err.message}` };
  }

  const freshGini = freshRaw.summary?.votingPowerGini;
  const freshVoters = freshRaw.summary?.uniqueVoters;
  if (typeof freshGini !== 'number' || typeof freshVoters !== 'number') {
    return { ok: false, error: 'audit-snapshot output missing votingPowerGini/uniqueVoters' };
  }

  const storedGini = storedRow.gini;
  const storedVoters = storedRow.voters;
  const deltaGini = freshGini - storedGini;
  const deltaVoters = freshVoters - (storedVoters ?? 0);
  const drift = classifyDrift(deltaGini, threshold);
  const architecture = storedRow.architecture;
  const predicted = architecture === 'discrete' ? 'stable' : 'worse';
  const matchesPrediction = drift === predicted;

  return {
    ok: true,
    result: {
      space,
      name,
      architecture,
      stored: { gini: storedGini, voters: storedVoters },
      fresh: { gini: freshGini, voters: freshVoters },
      delta: { gini: Number(deltaGini.toFixed(4)), voters: deltaVoters },
      drift,
      threshold,
      predictedByArchitecture: predicted,
      matchesPrediction,
    },
  };
}

export const compareTimeWindowHandler = {
  builder: (yargs: Argv) =>
    yargs
      .option('space', {
        type: 'string',
        describe: 'Snapshot space id (e.g. aavedao.eth). Mutually exclusive with --all.',
      })
      .option('threshold', {
        type: 'number',
        default: 0.01,
        describe: 'Absolute Gini delta to count as drift (default 0.01, slightly above Aavegotchi noise floor)',
      })
      .option('all', {
        type: 'boolean',
        default: false,
        describe: 'Compare ALL stored spaces in SPACE_TO_NAME mapping. Mutually exclusive with --space.',
      })
      .check(argv => {
        if (!argv.space && !argv.all) {
          throw new Error('One of --space or --all is required');
        }
        if (argv.space && argv.all) {
          throw new Error('--space and --all are mutually exclusive');
        }
        return true;
      }),

  handler: async (argv: ArgumentsCamelCase<CompareTimeWindowArgs>) => {
    const threshold = argv.threshold ?? 0.01;

    // --all mode: iterate every space in SPACE_TO_NAME, collect results,
    // print a sortable summary table. JSON mode emits the full array.
    if (argv.all) {
      const spaces = Object.keys(SPACE_TO_NAME).sort();
      const results: any[] = [];
      const errors: any[] = [];
      for (const sp of spaces) {
        const r = await compareOneSpace(sp, threshold);
        if (r.ok) results.push(r.result);
        else errors.push({ space: sp, error: r.error });
      }

      // Tally counts grouped by (architecture, drift)
      const tally: Record<string, number> = {
        'discrete-stable': 0,
        'discrete-worse': 0,
        'discrete-better': 0,
        'divisible-stable': 0,
        'divisible-worse': 0,
        'divisible-better': 0,
      };
      for (const r of results) {
        tally[`${r.architecture}-${r.drift}`] =
          (tally[`${r.architecture}-${r.drift}`] || 0) + 1;
      }

      if (output.isJsonMode()) {
        output.json({ count: results.length, errors, tally, results });
        return;
      }

      // Text mode summary table — sorted by drift magnitude descending.
      results.sort((a, b) => Math.abs(b.delta.gini) - Math.abs(a.delta.gini));
      console.log('');
      console.log(`  Compare-time-window — ${results.length} spaces (${errors.length} errors)`);
      console.log('  ' + '─'.repeat(78));
      console.log('  ' + ['Name'.padEnd(22), 'Arch'.padEnd(11), 'Stored'.padEnd(8), 'Fresh'.padEnd(8), 'Δ Gini'.padEnd(10), 'Drift'].join(' '));
      console.log('  ' + '─'.repeat(78));
      for (const r of results) {
        const deltaStr = (r.delta.gini >= 0 ? '+' : '') + r.delta.gini.toFixed(4);
        const driftIcon = r.drift === 'worse' ? '↑' : r.drift === 'better' ? '↓' : '→';
        const matchIcon = r.matchesPrediction ? '✓' : '✗';
        console.log('  ' + [
          r.name.padEnd(22),
          r.architecture.padEnd(11),
          r.stored.gini.toFixed(3).padEnd(8),
          r.fresh.gini.toFixed(3).padEnd(8),
          deltaStr.padEnd(10),
          `${driftIcon} ${r.drift} ${matchIcon}`,
        ].join(' '));
      }
      console.log('  ' + '─'.repeat(78));
      console.log(`  Tally: discrete ${tally['discrete-stable']}st/${tally['discrete-worse']}↑/${tally['discrete-better']}↓ · divisible ${tally['divisible-stable']}st/${tally['divisible-worse']}↑/${tally['divisible-better']}↓`);
      if (errors.length > 0) {
        console.log('  Errors:');
        for (const e of errors) console.log(`    ${e.space}: ${e.error}`);
      }
      console.log('');
      return;
    }

    // Single-space mode (existing behavior).
    const space = argv.space!.trim();
    const name = SPACE_TO_NAME[space];

    if (!name) {
      const known = Object.keys(SPACE_TO_NAME).sort().join(', ');
      output.error(
        `Space "${space}" not in AUDIT_DB lookup. Known spaces: ${known}. ` +
          'Add the space → name mapping in src/commands/org/compare-time-window.ts.',
      );
      process.exitCode = 1;
      return;
    }

    // Read the stored entry by parsing portfolio --json output. This
    // avoids importing portfolio.ts (which has heavy spinner/output
    // side effects on import) and keeps the AUDIT_DB single-source-of-truth
    // in portfolio.ts itself.
    let storedRow: any;
    try {
      const portfolioOut = execFileSync(
        process.execPath,
        [process.argv[1], 'org', 'portfolio', '--json'],
        { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] },
      );
      const portfolio = JSON.parse(portfolioOut);
      const rows: any[] = portfolio.rows ?? [];
      storedRow = rows.find(r => r.name === name);
      if (!storedRow) {
        output.error(`Space "${space}" maps to name "${name}" but no AUDIT_DB row found.`);
        process.exitCode = 1;
        return;
      }
    } catch (err: any) {
      output.error(`Failed to read portfolio AUDIT_DB: ${err.message}`);
      process.exitCode = 1;
      return;
    }

    // Fetch fresh audit data via shelling out to audit-snapshot.
    let freshRaw: any;
    try {
      const auditOut = execFileSync(
        process.execPath,
        [process.argv[1], 'org', 'audit-snapshot', '--space', space, '--json'],
        { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] },
      );
      freshRaw = JSON.parse(auditOut);
      if (freshRaw.status === 'error') {
        output.error(`audit-snapshot failed: ${freshRaw.message}`);
        process.exitCode = 1;
        return;
      }
    } catch (err: any) {
      output.error(`Failed to run audit-snapshot for "${space}": ${err.message}`);
      process.exitCode = 1;
      return;
    }

    const freshGini = freshRaw.summary?.votingPowerGini;
    const freshVoters = freshRaw.summary?.uniqueVoters;
    if (typeof freshGini !== 'number' || typeof freshVoters !== 'number') {
      output.error(`audit-snapshot output missing votingPowerGini/uniqueVoters for ${space}.`);
      process.exitCode = 1;
      return;
    }

    const storedGini = storedRow.gini;
    const storedVoters = storedRow.voters;
    const deltaGini = freshGini - storedGini;
    const deltaVoters = freshVoters - (storedVoters ?? 0);
    const drift = classifyDrift(deltaGini, threshold);
    const architecture = storedRow.architecture;

    // Honest framing: predict the drift direction based on architecture.
    // Discrete cluster should be stable; divisible cohort should drift
    // worse. Surface the prediction + actual.
    const predicted = architecture === 'discrete' ? 'stable' : 'worse';
    const matchesPrediction = drift === predicted || (predicted === 'worse' && drift === 'worse');

    const result = {
      space,
      name,
      architecture,
      stored: { gini: storedGini, voters: storedVoters },
      fresh: { gini: freshGini, voters: freshVoters },
      delta: { gini: Number(deltaGini.toFixed(4)), voters: deltaVoters },
      drift,
      threshold,
      predictedByArchitecture: predicted,
      matchesPrediction,
    };

    if (output.isJsonMode()) {
      output.json(result);
      return;
    }

    // Text mode: a punchy single-screen summary.
    console.log('');
    console.log(`  ${name} (${space}) — ${architecture} architecture`);
    console.log('  ' + '─'.repeat(60));
    console.log(`  Stored:    Gini ${storedGini.toFixed(3)}, voters ${storedVoters ?? '?'}`);
    console.log(`  Fresh:     Gini ${freshGini.toFixed(3)}, voters ${freshVoters}`);
    const deltaStr = deltaGini >= 0 ? `+${deltaGini.toFixed(4)}` : deltaGini.toFixed(4);
    const driftIcon = drift === 'worse' ? '↑' : drift === 'better' ? '↓' : '→';
    console.log(`  Drift:     ${driftIcon} ${deltaStr} Gini · ${deltaVoters >= 0 ? '+' : ''}${deltaVoters} voters · ${drift.toUpperCase()}`);
    console.log(`  Predicted: ${predicted} (architecture: ${architecture})`);
    console.log(`  Matches:   ${matchesPrediction ? '✓' : '✗'}`);
    console.log('');
    if (drift === 'worse' && Math.abs(deltaGini) > 0.05) {
      console.log(`  ⚠ Significant concentration drift (${deltaStr}). Consider re-pinning the portfolio and updating any outreach drafts that cite the stored numbers.`);
      console.log('');
    }
  },
};
