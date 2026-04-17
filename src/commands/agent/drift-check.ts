/**
 * pop agent drift-check — detect plateau-hold drift in heartbeat-log.md.
 *
 * Closes the HB#388 argus self-direction protocol loop with tooling.
 * Protocols alone didn't prevent fleet-wide plateau-hold drift (argus
 * HB#369-387, vigil HB#377-396, sentinel HB#643-661). This command
 * surfaces the pattern BEFORE the 3-HB mandatory self-audit threshold.
 *
 * Algorithm: scan the last N HB sections in heartbeat-log.md, classify
 * each as "substantive" or "minimal/no-op" via forbidden-framing keywords
 * ("plateau hold", "operator silence", "no state change", "quiet interval",
 * "escape-hatch", "monitor/review") and heuristics (body < 200 chars OR
 * no shipped-artifact indicator).
 *
 * Exits nonzero (2) if count >= threshold, triggering pre-commit / CI /
 * HB Step 2.5 halt.
 */

import type { Argv, ArgumentsCamelCase } from 'yargs';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import * as output from '../../lib/output';

interface Args {
  json?: boolean;
  threshold?: number;
  lookback?: number;
  logPath?: string;
}

const FORBIDDEN_FRAMINGS = [
  'plateau hold',
  'operator silence',
  'no state change',
  'quiet interval',
  'escape-hatch',
  'monitor/review',
  'same as last HB',
  'minimal (unchanged)',
  'stall legibility',
];

const SUBSTANTIVE_MARKERS = [
  'shipped',
  'commit ',
  'lesson ID',
  'headCid',
  'Task #',
  'peer review',
  'audit',
  'refresh',
  'brainstorm',
  'contribute',
  'tombstoned',
  'drift detected',
  'self-audit',
];

export interface HbSection {
  header: string;
  body: string;
  hbNumber: number | null;
}

export interface DriftReport {
  status: 'clean' | 'warning' | 'drift';
  lookback: number;
  threshold: number;
  totalSections: number;
  minimalCount: number;
  substantiveCount: number;
  minimalSections: Array<{ header: string; reasons: string[] }>;
  warning?: string;
}

export function parseHbSections(log: string, lookback: number): HbSection[] {
  const lines = log.split('\n');
  const sections: HbSection[] = [];
  let currentHeader: string | null = null;
  let currentBody: string[] = [];
  let currentHbNumber: number | null = null;
  for (const line of lines) {
    const hbMatch = line.match(/^##\s+HB#(\d+)/);
    if (hbMatch) {
      if (currentHeader !== null) {
        sections.push({
          header: currentHeader,
          body: currentBody.join('\n'),
          hbNumber: currentHbNumber,
        });
      }
      currentHeader = line;
      currentBody = [];
      currentHbNumber = parseInt(hbMatch[1], 10);
    } else if (currentHeader !== null) {
      currentBody.push(line);
    }
  }
  if (currentHeader !== null) {
    sections.push({
      header: currentHeader,
      body: currentBody.join('\n'),
      hbNumber: currentHbNumber,
    });
  }
  return sections.slice(-lookback);
}

export function classifySection(section: HbSection): { minimal: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const text = (section.header + '\n' + section.body).toLowerCase();
  const framingMentions: string[] = [];
  for (const framing of FORBIDDEN_FRAMINGS) {
    if (text.includes(framing.toLowerCase())) {
      framingMentions.push(framing);
    }
  }
  const hasSubstantiveMarker = SUBSTANTIVE_MARKERS.some(m => text.includes(m.toLowerCase()));
  const bodyLen = section.body.trim().length;
  const shortBody = bodyLen < 200;
  const missingSubstantiveMarker = !hasSubstantiveMarker;
  // Structural signals — missing-marker OR short-body — are the load-bearing
  // drift diagnostics. Forbidden-framing mentions only count when paired with
  // at least one structural signal; discussing the pattern in a self-correction
  // or peer-review context does not itself indicate drift.
  const hasStructuralDriftSignal = missingSubstantiveMarker || shortBody;
  if (hasStructuralDriftSignal) {
    for (const framing of framingMentions) {
      reasons.push(`forbidden framing: "${framing}"`);
    }
  }
  if (missingSubstantiveMarker) {
    reasons.push('no substantive-action marker (shipped/commit/lesson/task/audit)');
  }
  if (shortBody) {
    reasons.push(`body too short (${bodyLen} chars, < 200 threshold)`);
  }
  // Drift if: (short body AND missing marker) OR (≥2 reasons with at least one structural)
  const minimal = hasStructuralDriftSignal && reasons.length >= 2;
  return { minimal, reasons };
}

export function analyzeDrift(
  log: string,
  lookback: number = 5,
  threshold: number = 2,
): DriftReport {
  const sections = parseHbSections(log, lookback);
  const minimalSections: Array<{ header: string; reasons: string[] }> = [];
  let minimalCount = 0;
  let substantiveCount = 0;
  for (const section of sections) {
    const { minimal, reasons } = classifySection(section);
    if (minimal) {
      minimalCount++;
      minimalSections.push({ header: section.header.trim(), reasons });
    } else {
      substantiveCount++;
    }
  }
  const report: DriftReport = {
    status: 'clean',
    lookback,
    threshold,
    totalSections: sections.length,
    minimalCount,
    substantiveCount,
    minimalSections,
  };
  if (minimalCount >= threshold) {
    report.status = 'drift';
    report.warning = `${minimalCount} consecutive minimal/no-op HBs in last ${lookback} (threshold ${threshold}) — per HB#388 self-direction protocol next HB MUST ship substantive artifact. Ref argus commit f7f0dc2.`;
  } else if (minimalCount > 0) {
    report.status = 'warning';
    report.warning = `${minimalCount} minimal HB(s) in last ${lookback}. Not yet at drift threshold ${threshold}, but next HB should trend substantive.`;
  }
  return report;
}

export const driftCheckHandler = {
  builder: (yargs: Argv) =>
    yargs
      .option('json', { type: 'boolean', default: false })
      .option('threshold', {
        type: 'number',
        default: 2,
        describe: 'Minimal-HB count at which to report drift (exits nonzero)',
      })
      .option('lookback', {
        type: 'number',
        default: 5,
        describe: 'Number of most-recent HB sections to analyze',
      })
      .option('log-path', {
        type: 'string',
        describe: 'Override heartbeat-log.md path (default: ~/.pop-agent/brain/Memory/heartbeat-log.md)',
      }),
  handler: async (argv: ArgumentsCamelCase<Args>) => {
    const home = process.env.HOME || '';
    const defaultPath = resolve(home, '.pop-agent/brain/Memory/heartbeat-log.md');
    const logPath = argv.logPath ? resolve(String(argv.logPath)) : defaultPath;
    if (!existsSync(logPath)) {
      const err = `heartbeat-log.md not found at ${logPath}`;
      if (argv.json) {
        output.json({ status: 'error', error: err });
      } else {
        output.error(err);
      }
      process.exit(1);
    }
    const log = readFileSync(logPath, 'utf8');
    const report = analyzeDrift(log, argv.lookback ?? 5, argv.threshold ?? 2);
    if (argv.json) {
      output.json(report);
    } else {
      output.info(`drift-check: ${report.status} (${report.minimalCount}/${report.totalSections} minimal, threshold ${report.threshold})`);
      if (report.warning) output.warn(report.warning);
      if (report.minimalSections.length > 0) {
        output.info('Minimal sections:');
        for (const s of report.minimalSections) {
          output.info(`  ${s.header}`);
          for (const r of s.reasons) output.info(`    - ${r}`);
        }
      }
    }
    process.exit(report.status === 'drift' ? 2 : 0);
  },
};
