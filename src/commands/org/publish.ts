import type { Argv, ArgumentsCamelCase } from 'yargs';
import * as output from '../../lib/output';
import { pinJson } from '../../lib/ipfs';

interface PublishArgs {
  org: string;
  cid: string;
  title: string;
  description?: string;
  chain?: number;
}

export const publishHandler = {
  builder: (yargs: Argv) => yargs
    .option('cid', { type: 'string', demandOption: true, describe: 'IPFS CID of content to publish' })
    .option('title', { type: 'string', demandOption: true, describe: 'Page title' })
    .option('description', { type: 'string', default: '', describe: 'Page description for social sharing' }),

  handler: async (argv: ArgumentsCamelCase<PublishArgs>) => {
    const spin = output.spinner('Creating shareable page...');
    spin.start();

    try {
      const contentCid = argv.cid as string;
      const title = argv.title as string;
      const desc = (argv.description as string) || title;

      // Fetch content from IPFS
      spin.text = 'Fetching content...';
      const response = await fetch(`https://ipfs.io/ipfs/${contentCid}`, { signal: AbortSignal.timeout(15000) });
      const raw = await response.text();

      // Detect format and convert to HTML body
      let body: string;
      try {
        const json = JSON.parse(raw);
        // JSON content — extract text
        body = json.content || json.body || JSON.stringify(json, null, 2);
      } catch {
        if (raw.startsWith('<!DOCTYPE') || raw.startsWith('<html')) {
          // Already HTML — use as-is but add OG tags
          const withOg = raw.replace('<head>', `<head>
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:type" content="article">
<meta property="og:url" content="https://ipfs.io/ipfs/${contentCid}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${desc}">`);
          const cid = await pinJson(withOg);
          spin.stop();
          if (argv.json) {
            output.json({ cid, url: `https://ipfs.io/ipfs/${cid}`, title, description: desc, source: contentCid });
          } else {
            output.success('Published', { url: `https://ipfs.io/ipfs/${cid}`, title });
          }
          return;
        }
        body = raw; // Markdown or plain text
      }

      // Convert markdown-ish content to HTML paragraphs
      const htmlBody = body.split('\n').map((line: string) => {
        line = line.trim();
        if (!line) return '';
        if (line.startsWith('## ')) return `<h2>${line.slice(3)}</h2>`;
        if (line.startsWith('# ')) return `<h1>${line.slice(2)}</h1>`;
        return `<p>${line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</p>`;
      }).join('\n');

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:type" content="article">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${desc}">
<style>
body { max-width: 680px; margin: 40px auto; padding: 0 20px; font-family: Georgia, serif; line-height: 1.7; color: #333; }
h1 { font-size: 2em; } h2 { margin-top: 2em; color: #1a1a2e; }
.footer { margin-top: 3em; padding-top: 1em; border-top: 1px solid #ddd; font-size: 0.85em; color: #888; }
</style>
</head>
<body>
${htmlBody}
<div class="footer">
<p><strong>Argus</strong> — governance intelligence by AI agents. <a href="https://poa.box">poa.box</a></p>
</div>
</body></html>`;

      spin.text = 'Pinning HTML page...';
      const cid = await pinJson(html);

      spin.stop();
      if (argv.json) {
        output.json({ cid, url: `https://ipfs.io/ipfs/${cid}`, title, description: desc, source: contentCid });
      } else {
        output.success('Published', { url: `https://ipfs.io/ipfs/${cid}`, title });
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
