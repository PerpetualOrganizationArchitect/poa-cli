/**
 * pop agent test-coverage — hygiene signal for test presence.
 *
 * Complements vitest's line-coverage with a coarser question:
 * "does every src/lib module have ANY dedicated test file?" Walks
 * src/lib/*.ts and test/lib/*.test.ts; matches by filename stem.
 *
 * This is NOT a substitute for vitest --coverage (which measures
 * line/branch execution). It's a zero-dependency pre-commit-style
 * check: for each module, does a test file exist? Easy to run, fast,
 * surfaces the kind of gap that HB#320 (cacheFileStats had zero
 * tests) and HB#325 (label-aliases untested) left sitting.
 */

import type { Argv, ArgumentsCamelCase } from 'yargs';
import { readdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import * as output from '../../lib/output';

interface Args {
  json?: boolean;
  threshold?: number;
  scope?: string;
  repo?: string;
}

/**
 * List module stems for a directory (filenames without the specified suffix).
 * Returns sorted array. Returns [] if dir missing.
 */
export function listModuleStems(dir: string, suffix: string): string[] {
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir);
  const stems: string[] = [];
  for (const f of files) {
    if (!f.endsWith(suffix)) continue;
    stems.push(f.slice(0, -suffix.length));
  }
  return stems.sort();
}

export interface CoverageResult {
  scope: string;
  total: number;
  tested: number;
  untested: number;
  coveragePct: number;
  testedModules: string[];
  untestedModules: string[];
}

export function computeCoverage(repoRoot: string, scope: 'lib' = 'lib'): CoverageResult {
  const srcDir = resolve(repoRoot, 'src', scope);
  const testDir = resolve(repoRoot, 'test', scope);
  const modules = listModuleStems(srcDir, '.ts');
  const tests = new Set(listModuleStems(testDir, '.test.ts'));
  const testedModules: string[] = [];
  const untestedModules: string[] = [];
  for (const m of modules) {
    if (tests.has(m)) testedModules.push(m);
    else untestedModules.push(m);
  }
  const total = modules.length;
  const tested = testedModules.length;
  const coveragePct = total === 0 ? 0 : Number(((tested / total) * 100).toFixed(1));
  return {
    scope,
    total,
    tested,
    untested: untestedModules.length,
    coveragePct,
    testedModules,
    untestedModules,
  };
}

export const testCoverageHandler = {
  builder: (yargs: Argv) =>
    yargs
      .option('threshold', {
        type: 'number',
        describe: 'Exit non-zero if coverage (tested / total * 100) is below this percentage. Default: no gating.',
      })
      .option('scope', {
        type: 'string',
        default: 'lib',
        choices: ['lib'],
        describe: 'Scope to check. Currently only "lib" (src/lib vs test/lib).',
      })
      .option('repo', {
        type: 'string',
        describe: 'Repo root (defaults to process.cwd()). For testing.',
      }),

  handler: async (argv: ArgumentsCamelCase<Args>) => {
    const repoRoot = (argv.repo as string) || process.cwd();
    const result = computeCoverage(repoRoot, 'lib');

    if (output.isJsonMode()) {
      output.json(result);
    } else {
      console.log('');
      console.log(`  Test coverage (${result.scope}) — ${result.coveragePct}%`);
      console.log('  ' + '─'.repeat(60));
      console.log(`  total modules:   ${result.total}`);
      console.log(`  tested:          ${result.tested}`);
      console.log(`  untested:        ${result.untested}`);
      console.log('');
      if (result.untestedModules.length > 0) {
        console.log(`  Untested modules (${result.untestedModules.length}):`);
        for (const m of result.untestedModules) {
          console.log(`    - src/${result.scope}/${m}.ts`);
        }
        console.log('');
      }
    }

    if (typeof argv.threshold === 'number' && result.coveragePct < argv.threshold) {
      if (!output.isJsonMode()) {
        console.error(`  ✗ Coverage ${result.coveragePct}% below threshold ${argv.threshold}%`);
      }
      process.exit(1);
    }
  },
};
