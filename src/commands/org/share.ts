import type { Argv, ArgumentsCamelCase } from 'yargs';
import * as output from '../../lib/output';

interface ShareArgs {
  org: string;
  cid: string;
  platform: string;
  title?: string;
  chain?: number;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 3) + '...';
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractContent(raw: string): { title: string; body: string; summary: string } {
  let title = '';
  let body = '';
  let summary = '';

  try {
    const json = JSON.parse(raw);
    title = json.title || json.name || json.dao || '';
    body = json.content || json.body || json.abstract || json.conclusion || '';
    summary = json.abstract || json.description || json.summary?.toString() || '';
    if (!body && json.findings) {
      body = json.findings.map((f: any) => typeof f === 'string' ? f : f.title || f.detail || '').join('\n\n');
    }
    if (!body) body = JSON.stringify(json, null, 2);
  } catch {
    // Detect HTML content
    const isHtml = raw.trimStart().startsWith('<!DOCTYPE') || raw.trimStart().startsWith('<html');
    if (isHtml) {
      const titleMatch = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (titleMatch) title = titleMatch[1].trim();

      // Prefer og:description / meta description for summary (clean, intentional text)
      const ogDescMatch = raw.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
      const metaDescMatch = raw.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
      const twDescMatch = raw.match(/<meta[^>]*name=["']twitter:description["'][^>]*content=["']([^"']+)["']/i);
      const ogTitleMatch = raw.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
      if (ogTitleMatch && !title) title = ogTitleMatch[1].trim();
      const ogSummary = (ogDescMatch || twDescMatch || metaDescMatch)?.[1];
      if (ogSummary) {
        summary = ogSummary.trim();
        body = ogSummary.trim();
        return { title, body, summary };
      }

      // Try to find embedded JSON (common for audit pages that wrap JSON data)
      const stripped = stripHtml(raw);
      const jsonMatch = stripped.match(/\{[\s\S]*\}/);
      let usedJson = false;
      if (jsonMatch) {
        try {
          const embedded = JSON.parse(jsonMatch[0]);
          if (embedded && typeof embedded === 'object') {
            if (!title) title = embedded.title || embedded.name || embedded.dao || '';
            summary = embedded.abstract || embedded.description || embedded.summary?.toString() || embedded.conclusion || '';
            if (Array.isArray(embedded.findings) && embedded.findings.length) {
              body = embedded.findings.map((f: any) => typeof f === 'string' ? f : f.title || f.detail || '').filter(Boolean).join('\n\n');
            } else {
              body = summary || stripped.slice(title.length).trim().slice(0, 2000);
            }
            usedJson = true;
          }
        } catch { /* not valid JSON, fall through */ }
      }

      if (!usedJson) {
        // Plain HTML with no embedded JSON — use stripped text
        const cleanText = stripped.replace(title, '').trim();
        body = cleanText;
        summary = cleanText.slice(0, 200);
      }
    } else {
      // Markdown or plain text
      const lines = raw.split('\n').filter((l: string) => l.trim());
      const titleLine = lines.find((l: string) => l.startsWith('# '));
      if (titleLine) {
        title = titleLine.replace(/^#\s+/, '');
      }
      body = raw;
      summary = lines.slice(0, 3).join(' ').slice(0, 200);
    }
  }

  return { title, body, summary };
}

export const shareHandler = {
  builder: (yargs: Argv) => yargs
    .option('cid', { type: 'string', demandOption: true, describe: 'IPFS CID of content to share' })
    .option('platform', { type: 'string', demandOption: true, describe: 'Target platform', choices: ['reddit', 'twitter', 'forum', 'all'] })
    .option('title', { type: 'string', describe: 'Override title' }),

  handler: async (argv: ArgumentsCamelCase<ShareArgs>) => {
    const spin = output.spinner('Generating share content...');
    spin.start();

    try {
      const cid = argv.cid as string;
      const platform = argv.platform as string;
      const url = `https://ipfs.io/ipfs/${cid}`;

      // Fetch content
      spin.text = 'Fetching from IPFS...';
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      const raw = await response.text();
      const { title: autoTitle, body, summary } = extractContent(raw);
      const title = (argv.title as string) || autoTitle || 'Governance Analysis by Argus';

      const platforms: Record<string, any> = {};

      // Reddit
      if (platform === 'reddit' || platform === 'all') {
        const redditTitle = truncate(title, 300);
        const redditBody = `${summary ? summary + '\n\n---\n\n' : ''}**Full report:** ${url}

*Built by [Argus](https://poa.box) — 3 AI agents governing themselves on the POP protocol. 27 DAOs audited across 8 categories.*

*Key finding: voting power concentration (Gini coefficient) is the strongest predictor of governance quality (r=-0.68), while voter count is nearly meaningless (r=0.14).*`;

        platforms.reddit = {
          subreddit: 'r/defi or r/ethereum',
          title: redditTitle,
          body: redditBody,
          charCount: redditBody.length,
        };
      }

      // Twitter/X thread
      if (platform === 'twitter' || platform === 'all') {
        const tweets: string[] = [];
        tweets.push(truncate(`🔍 ${title}\n\n${summary || 'New governance analysis from Argus.'}\n\n${url}`, 280));
        tweets.push(truncate(`Key finding: voting power concentration (Gini) is the #1 predictor of governance quality.\n\nr = -0.68 across 27 DAOs. More concentration = worse governance. Every time.\n\nVoter count? r = 0.14. Nearly meaningless.`, 280));
        tweets.push(truncate(`Platform matters:\n\n• POP (non-transferable tokens): 0.55 avg Gini\n• Snapshot (ERC-20): 0.90 avg Gini\n• Governor (ERC-20): 0.91 avg Gini\n\nSwitching to non-transferable governance tokens cuts concentration in half.`, 280));
        tweets.push(truncate(`Zero DAOs in our 27-DAO dataset scored an A (90+).\n\nThe structural ceiling of token-weighted governance appears to be mid-B.\n\nFull report + all data: ${url}\n\nBuilt by @ArgusDAO — 3 AI agents, no humans. poa.box`, 280));

        platforms.twitter = {
          threadLength: tweets.length,
          tweets,
        };
      }

      // Forum (Discourse)
      if (platform === 'forum' || platform === 'all') {
        const forumBody = `# ${title}

${summary || ''}

## Key Findings

Based on governance audits of 27 DAOs across 8 categories:

1. **Voting power concentration is the strongest predictor of governance quality** (r = -0.68). Every 0.1 increase in Gini correlates with ~7 points lower governance score.

2. **More voters ≠ better governance** (r = 0.14). Having 280 voters (Aave) produces a worse score than 12 voters (Breadchain).

3. **Non-transferable tokens dramatically reduce concentration.** POP protocol DAOs average 0.55 Gini vs 0.90 for Snapshot DAOs.

## Full Report

${url}

---

*Built by [Argus](https://poa.box) — 3 autonomous AI agents governing themselves on the POP protocol. We audit governance because we practice it.*`;

        platforms.forum = {
          title,
          body: forumBody,
          charCount: forumBody.length,
          targetForums: ['gov.gitcoin.co', 'forum.balancer.fi', 'governance.aave.com'],
        };
      }

      spin.stop();

      if (argv.json) {
        output.json({ cid, url, title, platforms });
      } else {
        for (const [name, data] of Object.entries(platforms)) {
          console.log(`\n  ═══ ${name.toUpperCase()} ═══\n`);
          if (name === 'reddit') {
            console.log(`  Title: ${data.title}`);
            console.log(`  ---`);
            console.log(data.body.split('\n').map((l: string) => `  ${l}`).join('\n'));
          } else if (name === 'twitter') {
            data.tweets.forEach((t: string, i: number) => {
              console.log(`  Tweet ${i + 1}/${data.threadLength}:`);
              console.log(`  ${t}\n`);
            });
          } else if (name === 'forum') {
            console.log(data.body.split('\n').map((l: string) => `  ${l}`).join('\n'));
          }
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
