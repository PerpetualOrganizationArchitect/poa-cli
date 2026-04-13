/**
 * Brain migration — one-shot parser that converts the hand-written
 * agent/brain/Knowledge/shared.md (and siblings) into a structured
 * SharedBrainDoc for seeding the Automerge CRDT layer.
 *
 * This is step 8 of the brain plan (cheeky-nibbling-raven.md).
 * After this file has been run once on each hand-written knowledge
 * file, the CRDT substrate is the source of truth and the hand-written
 * files become historical snapshots.
 *
 * ## Design notes
 *
 * - **Pure function.** parseSharedMarkdown takes a raw string and
 *   returns a SharedBrainDoc. No I/O, no Date.now, no environment
 *   reads. The CLI command handles all I/O and timestamp-from-now
 *   decisions.
 *
 * - **Heuristic, not canonical.** This is a one-shot parse; we're
 *   allowed to lose fidelity on layout details as long as the
 *   content content survives. Each H2 section becomes one entry.
 *
 * - **Short sections become rules, long sections become lessons.**
 *   A rule is a short-form policy item (one to a few lines of plain
 *   text, often bullet-led). A lesson is a longer structured
 *   narrative. The heuristic: if a section's body has more than 200
 *   characters OR contains a code fence, it's a lesson; otherwise
 *   it's a rule. This maps the existing hand-written file's mix of
 *   short policy bullets and long narrative notes to the brain doc
 *   schema cleanly.
 *
 * - **HB# tags → timestamps.** Lines containing `HB#N` or `(HB#N,
 *   author)` extract both the heartbeat number and the author.
 *   Timestamps are derived from HB# via a caller-provided anchor
 *   (see MigrationContext below) rather than guessed — keeps the
 *   parser pure.
 *
 * - **Code fences are preserved verbatim.** We do NOT split on ##
 *   headers inside a ``` block — that would corrupt embedded code
 *   samples. Tracked via a simple in-fence toggle.
 */

import type { SharedBrainDoc } from './brain-projections';

export interface MigrationContext {
  /**
   * Default author to assign to sections where no HB#/author tag was
   * found in the source. Typically the agent running the migration.
   */
  defaultAuthor: string;
  /**
   * Unix-seconds timestamp representing "now" for the migration run.
   * Sections without their own HB# tag get this timestamp — a
   * reasonable proxy for "discovered at migration time."
   */
  defaultTimestamp: number;
  /**
   * Caller-supplied function that turns a heartbeat number into a
   * unix-seconds timestamp. Pass in the "best guess" curve, typically
   * `now - (currentHB - N) * 15 * 60`. If omitted, all HB# tagged
   * sections fall back to defaultTimestamp.
   */
  timestampForHB?: (hb: number) => number;
}

export interface ParsedBrainDoc extends SharedBrainDoc {
  // Always present after a parse run — makes downstream handling
  // non-optional.
  rules: NonNullable<SharedBrainDoc['rules']>;
  lessons: NonNullable<SharedBrainDoc['lessons']>;
}

const HB_TAG_RE = /\(\s*HB#(\d+)(?:\s*,\s*([^\s)]+))?\s*\)/i;
const BARE_HB_RE = /\bHB#(\d+)\b/i;

/**
 * Slugify a string for use as an entry id. Keeps lowercase letters,
 * digits, and hyphens; collapses other characters to hyphens.
 */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Split raw markdown into sections delimited by `^## ` headers at
 * the top level. Returns an ordered list of { header, body } pairs.
 * Skips content before the first H2 (preamble) entirely — it's
 * usually the file's title and intro paragraph.
 *
 * Code fences are respected: `##` inside a ``` block is treated as
 * literal content, not a section break. This matters because the
 * hand-written shared.md embeds shell command examples with
 * triple-backtick fences, and one of those happens to include a
 * markdown header in a commented line.
 */
function splitSections(raw: string): Array<{ header: string; body: string }> {
  const lines = raw.split(/\r?\n/);
  const sections: Array<{ header: string; body: string }> = [];
  let inFence = false;
  let current: { header: string; body: string[] } | null = null;

  for (const line of lines) {
    // Track code fence state so we don't treat `##` inside code as
    // a new section.
    if (/^```/.test(line)) {
      inFence = !inFence;
      if (current) current.body.push(line);
      continue;
    }

    if (!inFence && /^##\s+/.test(line)) {
      if (current) sections.push({ header: current.header, body: current.body.join('\n').trim() });
      current = { header: line.replace(/^##\s+/, '').trim(), body: [] };
      continue;
    }

    if (current) current.body.push(line);
    // lines before the first H2 are dropped (preamble)
  }

  if (current) sections.push({ header: current.header, body: current.body.join('\n').trim() });
  return sections;
}

/**
 * Extract an HB#/author tag from a block of text. Returns the first
 * match found (usually the header or the first body line). Returns
 * null if nothing matches.
 */
function extractHBTag(text: string): { hb: number; author: string | null } | null {
  const m = HB_TAG_RE.exec(text);
  if (m) return { hb: Number(m[1]), author: m[2] ?? null };
  const bare = BARE_HB_RE.exec(text);
  if (bare) return { hb: Number(bare[1]), author: null };
  return null;
}

/**
 * Parse the hand-written shared.md (or similar) into a SharedBrainDoc.
 *
 * Pure function — no I/O, no Date.now, no env reads. The caller must
 * supply the migration context (default author, default timestamp,
 * optional HB→timestamp function).
 */
export function parseSharedMarkdown(raw: string, ctx: MigrationContext): ParsedBrainDoc {
  const sections = splitSections(raw);

  const rules: NonNullable<SharedBrainDoc['rules']> = [];
  const lessons: NonNullable<SharedBrainDoc['lessons']> = [];

  for (const { header, body } of sections) {
    if (body.length === 0) continue;

    const combinedForTagHunt = `${header}\n${body.split('\n').slice(0, 2).join('\n')}`;
    const tag = extractHBTag(combinedForTagHunt);
    const author = tag?.author ?? ctx.defaultAuthor;
    const timestamp =
      tag && ctx.timestampForHB
        ? ctx.timestampForHB(tag.hb)
        : ctx.defaultTimestamp;

    const hasCodeFence = /^```/m.test(body);
    const isLesson = body.length > 200 || hasCodeFence;

    const id = slugify(header) || `section-${lessons.length + rules.length + 1}`;

    if (isLesson) {
      lessons.push({
        id,
        title: header,
        author,
        body,
        timestamp,
      });
    } else {
      rules.push({
        id,
        author,
        text: body,
        timestamp,
      });
    }
  }

  return { rules, lessons };
}
