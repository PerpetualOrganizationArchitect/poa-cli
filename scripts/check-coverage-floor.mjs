#!/usr/bin/env node
/**
 * Pre-commit coverage floor check (retro-344 change-5, HB#579).
 *
 * Counts how many src/lib/*.ts modules have a matching test file under
 * test/lib/. If the ratio falls below the floor, exits non-zero.
 *
 * Run:
 *   node scripts/check-coverage-floor.mjs              (default floor: 50)
 *   node scripts/check-coverage-floor.mjs --floor 60   (override floor)
 *   node scripts/check-coverage-floor.mjs --json       (machine output)
 *
 * Install as a pre-commit hook:
 *   ln -s ../../scripts/check-coverage-floor.mjs .git/hooks/pre-commit
 *   chmod +x scripts/check-coverage-floor.mjs
 *
 * This is a SIMPLE heuristic — module-count, not line-level coverage.
 * A module is considered "tested" iff test/lib/<basename>.test.ts exists.
 * Exceptions can be added to the IGNORE set below.
 */

import { readdirSync, existsSync } from 'fs';
import { dirname, join, resolve, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

// Modules intentionally not unit-tested (e.g. pure I/O orchestration,
// integration-test-only, deprecated). Keep this list short + justified.
const IGNORE = new Set([
  // (none right now — add a justifying comment per entry when adding)
]);

function parseArgs(argv) {
  const args = { floor: 50, json: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--floor' && argv[i + 1]) {
      args.floor = Number(argv[++i]);
    } else if (argv[i] === '--json') {
      args.json = true;
    }
  }
  if (!Number.isFinite(args.floor) || args.floor < 0 || args.floor > 100) {
    console.error(`invalid --floor value (must be 0-100)`);
    process.exit(2);
  }
  return args;
}

function listLibModules() {
  const libDir = join(REPO_ROOT, 'src', 'lib');
  return readdirSync(libDir)
    .filter(f => f.endsWith('.ts'))
    .map(f => basename(f, '.ts'))
    .filter(mod => !IGNORE.has(mod));
}

function hasTest(mod) {
  const testDir = join(REPO_ROOT, 'test', 'lib');
  return existsSync(join(testDir, `${mod}.test.ts`));
}

function main() {
  const args = parseArgs(process.argv);
  const modules = listLibModules();
  const tested = modules.filter(hasTest);
  const untested = modules.filter(m => !hasTest(m));
  const total = modules.length;
  const pct = total > 0 ? (tested.length / total) * 100 : 100;
  const pctRounded = Math.round(pct * 10) / 10;

  if (args.json) {
    console.log(JSON.stringify({
      total, tested: tested.length, untested: untested.length,
      coveragePct: pctRounded, floor: args.floor,
      pass: pctRounded >= args.floor,
      testedModules: tested,
      untestedModules: untested,
    }, null, 2));
    process.exit(pctRounded >= args.floor ? 0 : 1);
  }

  const icon = pctRounded >= args.floor ? '✓' : '✗';
  console.log(`${icon} lib coverage: ${tested.length}/${total} modules = ${pctRounded}% (floor: ${args.floor}%)`);
  if (pctRounded < args.floor) {
    console.log('');
    console.log(`Coverage below floor. Untested modules:`);
    for (const m of untested) console.log(`  - src/lib/${m}.ts`);
    console.log('');
    console.log(`Add a test file under test/lib/<module>.test.ts, or add the module to the IGNORE set in scripts/check-coverage-floor.mjs with a justifying comment.`);
    process.exit(1);
  }
  process.exit(0);
}

main();
