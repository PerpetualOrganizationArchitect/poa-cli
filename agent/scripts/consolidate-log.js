#!/usr/bin/env node
/**
 * Heartbeat Log Consolidation Script
 *
 * Compresses heartbeat-log.md by:
 * 1. Keeping last N heartbeats intact (default: 10)
 * 2. Compressing older entries to 1-line summaries
 * 3. Extracting lessons into lessons.md (max 20 items)
 * 4. Archiving entries older than 50 heartbeats to archive file
 *
 * Usage: node agent/scripts/consolidate-log.js [--dry-run] [--keep 10] [--archive-after 50]
 *
 * Brain paths default to ~/.pop-agent/brain/Memory/ but can be overridden
 * with BRAIN_MEMORY_DIR env var.
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const keepIdx = args.indexOf('--keep');
const archiveIdx = args.indexOf('--archive-after');
const keepRecent = keepIdx >= 0 ? parseInt(args[keepIdx + 1], 10) : 10;
const archiveAfter = archiveIdx >= 0 ? parseInt(args[archiveIdx + 1], 10) : 50;

const memoryDir = process.env.BRAIN_MEMORY_DIR ||
  path.join(process.env.HOME, '.pop-agent', 'brain', 'Memory');

const logPath = path.join(memoryDir, 'heartbeat-log.md');
const lessonsPath = path.join(memoryDir, 'lessons.md');
const archivePath = path.join(memoryDir, 'heartbeat-log-archive.md');

// Resolve agent name from who-i-am.md or fallback
let agentName = 'agent';
try {
  const whoPath = path.join(memoryDir, '..', 'Identity', 'who-i-am.md');
  const whoContent = fs.readFileSync(whoPath, 'utf8');
  const nameMatch = whoContent.match(/\*\*Username\*\*:\s*(\S+)/);
  if (nameMatch) agentName = nameMatch[1];
} catch { /* fallback to 'agent' */ }

// --- Parse ---

function parseHeartbeats(content) {
  const lines = content.split('\n');
  const header = [];
  const entries = [];
  let current = null;

  for (const line of lines) {
    const match = line.match(/^## HB#(\d+)\s*—\s*(.+)$/);
    if (match) {
      if (current) entries.push(current);
      current = {
        number: parseInt(match[1], 10),
        date: match[2].trim(),
        heading: line,
        body: [],
      };
    } else if (current) {
      current.body.push(line);
    } else {
      header.push(line);
    }
  }
  if (current) entries.push(current);

  // Sort descending by HB number
  entries.sort((a, b) => b.number - a.number);
  return { header, entries };
}

// --- Extract lessons ---

function extractLessons(entries) {
  const lessons = [];

  for (const entry of entries) {
    const bodyText = entry.body.join('\n');

    // Explicit **Lesson**: lines
    const lessonMatches = bodyText.matchAll(/\*\*Lesson\*?\*?:?\s*(.+)/gi);
    for (const m of lessonMatches) {
      lessons.push({
        source: `HB#${entry.number}`,
        date: entry.date,
        text: m[1].trim(),
      });
    }

    // Explicit **MILESTONE** lines
    const milestoneMatches = bodyText.matchAll(/\*\*MILESTONE:?\s*\*?\*?\s*(.+)/gi);
    for (const m of milestoneMatches) {
      // Strip trailing bold markers and leading colons/spaces
      const cleaned = m[1].replace(/\*\*/g, '').replace(/^[:\s]+/, '').trim();
      lessons.push({
        source: `HB#${entry.number}`,
        date: entry.date,
        text: `MILESTONE: ${cleaned}`,
      });
    }

    // **Correction** lines (learning from mistakes)
    const correctionMatches = bodyText.matchAll(/\*\*Correction\*?\*?:?\s*(.+)/gi);
    for (const m of correctionMatches) {
      lessons.push({
        source: `HB#${entry.number}`,
        date: entry.date,
        text: `CORRECTION: ${m[1].trim()}`,
      });
    }
  }

  // Deduplicate by similarity (keep the most recent)
  const seen = new Set();
  const unique = [];
  for (const lesson of lessons) {
    // Simple dedup: normalize and check first 60 chars
    const key = lesson.text.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(lesson);
    }
  }

  // Keep max 20, most recent first (lessons array is already in HB descending order)
  return unique.slice(0, 20);
}

// --- Compress ---

function compressEntry(entry) {
  const bodyText = entry.body.join(' ').replace(/\s+/g, ' ').trim();

  // Extract key actions from bold labels
  const actions = [];
  const boldMatches = bodyText.matchAll(/\*\*([^*]+)\*\*:?\s*([^*]*?)(?=\*\*|$)/g);
  for (const m of boldMatches) {
    const label = m[1].trim();
    const detail = m[2].trim();
    // Skip Txns and Context — those are metadata
    if (/^(Txns?|Context|Org state)$/i.test(label)) continue;
    // Truncate detail to ~80 chars
    const short = detail.length > 80 ? detail.slice(0, 77) + '...' : detail;
    if (short) actions.push(`${label}: ${short}`);
  }

  if (actions.length === 0) {
    // Fallback: first 120 chars of body
    const fallback = bodyText.slice(0, 120);
    return `## HB#${entry.number} — ${entry.date}\n${fallback}\n`;
  }

  // Join top 3 actions into a single line
  const summary = actions.slice(0, 3).join(' | ');
  return `## HB#${entry.number} — ${entry.date}\n${summary}\n`;
}

// --- Main ---

function main() {
  if (!fs.existsSync(logPath)) {
    console.error(`Log file not found: ${logPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(logPath, 'utf8');
  const { header, entries } = parseHeartbeats(content);

  if (entries.length === 0) {
    console.log('No heartbeat entries found. Nothing to consolidate.');
    return;
  }

  const maxHB = entries[0].number;
  console.log(`Found ${entries.length} heartbeat entries (HB#${entries[entries.length - 1].number} to HB#${maxHB})`);
  console.log(`Keeping last ${keepRecent} intact, compressing older, archiving after ${archiveAfter}`);

  // Categorize entries
  const recent = [];    // Keep intact (last N)
  const compress = [];  // Compress to 1-line
  const archive = [];   // Move to archive file

  for (const entry of entries) {
    const age = maxHB - entry.number;
    if (age < keepRecent) {
      recent.push(entry);
    } else if (age < archiveAfter) {
      compress.push(entry);
    } else {
      archive.push(entry);
    }
  }

  console.log(`  Recent (keep intact): ${recent.length}`);
  console.log(`  Compress: ${compress.length}`);
  console.log(`  Archive: ${archive.length}`);

  // Extract lessons from ALL entries (before archiving)
  const allProcessable = [...compress, ...archive];
  const lessons = extractLessons(allProcessable);
  console.log(`  Lessons extracted: ${lessons.length}`);

  // Build new log
  const parts = [];
  parts.push(header.join('\n'));

  // Recent entries — verbatim
  for (const entry of recent) {
    parts.push('');
    parts.push(entry.heading);
    parts.push(entry.body.join('\n'));
  }

  // Compressed entries
  if (compress.length > 0) {
    parts.push('');
    parts.push('## Compressed Heartbeats');
    parts.push('');
    for (const entry of compress) {
      parts.push(compressEntry(entry));
    }
  }

  // Reference to archive
  if (archive.length > 0) {
    parts.push('');
    parts.push(`## Archived Heartbeats (HB#${archive[archive.length - 1].number}–HB#${archive[0].number})`);
    parts.push(`See heartbeat-log-archive.md (${archive.length} entries)`);
  }

  const newLog = parts.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';

  // Build lessons file
  const existingLessons = fs.existsSync(lessonsPath)
    ? fs.readFileSync(lessonsPath, 'utf8')
    : '';

  // Parse existing lessons to merge
  const existingItems = [];
  if (existingLessons) {
    const matches = existingLessons.matchAll(/^\d+\.\s+(.+?)(?:\s*\(([^)]+)\))?$/gm);
    for (const m of matches) {
      existingItems.push({ text: m[1].trim(), source: m[2] || '' });
    }
  }

  // Merge: new lessons first, then existing, deduplicated, max 20
  const mergedLessons = [];
  const seenKeys = new Set();
  for (const lesson of [...lessons, ...existingItems.map(e => ({ ...e, date: '' }))]) {
    const key = (lesson.text || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      mergedLessons.push(lesson);
    }
  }

  const lessonsContent = [
    `# Lessons — ${agentName}`,
    `*Auto-consolidated from heartbeat log. Max 20 items. Last updated: ${new Date().toISOString().split('T')[0]}*`,
    '',
    ...mergedLessons.slice(0, 20).map((l, i) =>
      `${i + 1}. ${l.text}${l.source ? ` (${l.source})` : ''}`
    ),
    '',
  ].join('\n');

  // Build archive
  let archiveContent = '';
  if (archive.length > 0) {
    const existingArchive = fs.existsSync(archivePath)
      ? fs.readFileSync(archivePath, 'utf8')
      : `# Heartbeat Log Archive — ${agentName}\n\n`;

    const archiveParts = [existingArchive.trim()];
    for (const entry of archive) {
      archiveParts.push('');
      archiveParts.push(entry.heading);
      archiveParts.push(entry.body.join('\n'));
    }
    archiveContent = archiveParts.join('\n').trim() + '\n';
  }

  // Stats
  const originalLines = content.split('\n').length;
  const newLines = newLog.split('\n').length;
  console.log(`\nResult: ${originalLines} lines → ${newLines} lines (${Math.round((1 - newLines / originalLines) * 100)}% reduction)`);
  console.log(`Lessons: ${mergedLessons.length} (max 20 kept)`);

  if (dryRun) {
    console.log('\n--- DRY RUN — no files modified ---');
    console.log('\n=== New log preview (first 30 lines) ===');
    newLog.split('\n').slice(0, 30).forEach(l => console.log(l));
    console.log('\n=== Lessons preview ===');
    console.log(lessonsContent);
    return;
  }

  // Write files
  fs.writeFileSync(logPath, newLog);
  console.log(`Wrote: ${logPath}`);

  fs.writeFileSync(lessonsPath, lessonsContent);
  console.log(`Wrote: ${lessonsPath}`);

  if (archiveContent) {
    fs.writeFileSync(archivePath, archiveContent);
    console.log(`Wrote: ${archivePath}`);
  }

  console.log('\nConsolidation complete.');
}

main();
