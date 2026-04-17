/**
 * Deliverable check (task #465, sentinel retro-542 change-3).
 *
 * Pre-submit gate: scan submission text for referenced file paths and verify
 * they're committed to git. Blocks the HB#520 failure mode where task
 * submissions claimed deliverables that lived only in the working tree
 * (3,972 lines lost across multiple tasks; recovery commit b00624e).
 *
 * Pure local git inspection — no network, no daemon, fast (<50ms typical).
 * Heuristic biased toward UNDER-blocking (false negatives ok) over over-
 * blocking (false positives hurt operator trust). URLs, IPFS CIDs, tx
 * hashes, and inline code samples won't match the path pattern.
 */

import { execFileSync } from 'child_process';
import { existsSync, statSync } from 'fs';
import { resolve, isAbsolute } from 'path';

/**
 * Heuristic file-path matcher. Captures things like:
 *   src/lib/foo.ts
 *   agent/artifacts/research/bar.md
 *   docs/baz.json
 *   .claude/skills/qux/SKILL.md
 *   test/lib/quux.test.ts
 *
 * Requires at least one '/' (no bare filenames — too many false positives
 * on words like 'README.md' inline) and an extension. Excludes anything
 * that looks like a URL (token containing '://') or starts with 0x/Qm/bafy.
 *
 * Strategy: tokenize on whitespace first (so URLs stay attached to their
 * scheme and get filtered as a unit), THEN run the path regex on each
 * non-URL token.
 */
const PATH_REGEX = /^(\.?(?:[\w][\w.-]*\/)+[\w][\w.-]*\.[a-zA-Z][a-zA-Z0-9]{0,8})$/;

/** Extract candidate file paths from arbitrary text. Filters URLs + CIDs + hashes. */
export function extractReferencedPaths(text: string): string[] {
  if (!text) return [];
  const paths = new Set<string>();
  // Tokenize on any whitespace OR enclosing punctuation that's not part of a path
  // (parens, brackets, quotes, commas, semicolons). Slashes + dots + dashes stay.
  const tokens = text.split(/[\s()\[\]"'`,;]+/);
  for (const tok of tokens) {
    if (!tok) continue;
    // URL token? skip the whole thing
    if (tok.includes('://')) continue;
    // Hex prefix → tx hash chunk
    if (tok.startsWith('0x')) continue;
    // Trailing punctuation (period at end of sentence, colon)
    const cleaned = tok.replace(/[.:]+$/, '');
    if (!cleaned) continue;
    const m = cleaned.match(PATH_REGEX);
    if (!m) continue;
    const candidate = m[1];
    // CID-shaped first segment (Qm/bafy/bafk)
    if (/^(Qm[1-9A-HJ-NP-Za-km-z]{30,}|bafy[\w]{30,}|bafk[\w]{30,})/.test(candidate)) continue;
    paths.add(candidate);
  }
  return Array.from(paths);
}

export interface DeliverableCheckResult {
  /** Tracked + clean (no unstaged modifications). */
  committed: string[];
  /** Tracked but with unstaged modifications. */
  uncommitted: string[];
  /** Exists on disk but not in `git ls-files` (or in working tree only). */
  untracked: string[];
  /** Path didn't resolve to a file (false positive — ignored). */
  nonexistent: string[];
}

function gitLsFiles(cwd: string): Set<string> {
  try {
    const out = execFileSync('git', ['ls-files'], { stdio: ['ignore', 'pipe', 'pipe'], cwd }).toString();
    return new Set(out.split('\n').filter(Boolean));
  } catch {
    return new Set();
  }
}

function gitDirtyFiles(cwd: string): Set<string> {
  try {
    const out = execFileSync('git', ['diff', '--name-only', 'HEAD'], { stdio: ['ignore', 'pipe', 'pipe'], cwd }).toString();
    const staged = execFileSync('git', ['diff', '--cached', '--name-only'], { stdio: ['ignore', 'pipe', 'pipe'], cwd }).toString();
    return new Set([...out.split('\n').filter(Boolean), ...staged.split('\n').filter(Boolean)]);
  } catch {
    return new Set();
  }
}

/**
 * Classify a list of candidate paths against the local git state.
 * If git is unavailable, returns all paths as 'committed' (no-op gate).
 * @param cwd directory to run git in (defaults to process.cwd()). Tests pass an explicit tempdir.
 */
export function checkDeliverables(paths: string[], cwd: string = process.cwd()): DeliverableCheckResult {
  const result: DeliverableCheckResult = {
    committed: [], uncommitted: [], untracked: [], nonexistent: [],
  };
  if (paths.length === 0) return result;
  const lsFiles = gitLsFiles(cwd);
  if (lsFiles.size === 0) {
    // Git not present or empty repo — soft-fail to committed (don't block submits)
    for (const p of paths) result.committed.push(p);
    return result;
  }
  const dirty = gitDirtyFiles(cwd);
  for (const p of paths) {
    const abs = isAbsolute(p) ? p : resolve(cwd, p);
    const onDisk = existsSync(abs) && (() => {
      try { return statSync(abs).isFile(); } catch { return false; }
    })();
    if (!onDisk && !lsFiles.has(p)) {
      result.nonexistent.push(p);
      continue;
    }
    if (lsFiles.has(p)) {
      if (dirty.has(p)) result.uncommitted.push(p);
      else result.committed.push(p);
    } else {
      // exists on disk but not tracked
      result.untracked.push(p);
    }
  }
  return result;
}

/**
 * Format a remediation message for the operator.
 * Returns null if everything is committed (caller should NOT block).
 */
export function formatBlockMessage(result: DeliverableCheckResult): string | null {
  if (result.uncommitted.length === 0 && result.untracked.length === 0) return null;
  const lines: string[] = [];
  lines.push('Submission blocked: referenced deliverables are not committed to git.');
  lines.push('(retro-542 change-3 / task #465 — prevents the HB#520 loss-audit failure mode)');
  lines.push('');
  if (result.untracked.length > 0) {
    lines.push(`UNTRACKED (exist on disk, not in git index — ${result.untracked.length}):`);
    for (const p of result.untracked) lines.push(`  - ${p}`);
    lines.push('');
  }
  if (result.uncommitted.length > 0) {
    lines.push(`UNCOMMITTED (tracked, but with unstaged/staged modifications — ${result.uncommitted.length}):`);
    for (const p of result.uncommitted) lines.push(`  - ${p}`);
    lines.push('');
  }
  const allBad = [...result.untracked, ...result.uncommitted];
  lines.push('FIX:');
  lines.push(`  git add ${allBad.map((p) => `'${p}'`).join(' ')}`);
  lines.push(`  git commit -m "..."`);
  lines.push(`  pop task submit ...   # retry`);
  lines.push('');
  lines.push('Or override with --allow-uncommitted (use sparingly — references to ');
  lines.push('uncommitted files mean the submission claims work that may not exist).');
  return lines.join('\n');
}
