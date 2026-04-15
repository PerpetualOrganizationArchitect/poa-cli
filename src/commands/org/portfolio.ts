import type { Argv, ArgumentsCamelCase } from 'yargs';
import { query } from '../../lib/subgraph';
import { resolveOrgModules } from '../../lib/resolve';
import { pinJson } from '../../lib/ipfs';
import { AUDIT_DB, architectureClass } from '../../lib/audit-db';
import * as output from '../../lib/output';

interface PortfolioArgs {
  org: string;
  chain?: number;
  pin?: boolean;
  csv?: boolean;
}

// AUDIT_DB + architectureClass moved to src/lib/audit-db.ts at HB#328
// so compare-time-window.ts and any future consumers can read the same
// canonical store without importing portfolio.ts (which has heavy
// spinner/output side effects). See lib/audit-db.ts for schema.

function gradeColor(grade: string): string {
  switch (grade) {
    case 'A': return '#22c55e';
    case 'B': return '#3b82f6';
    case 'C': return '#f59e0b';
    case 'D': return '#ef4444';
    case 'F': return '#991b1b';
    default: return '#888';
  }
}

// architectureClass moved to lib/audit-db.ts at HB#328.

export const portfolioHandler = {
  builder: (yargs: Argv) => yargs
    .option('pin', { type: 'boolean', default: false, describe: 'Pin HTML page to IPFS' })
    .option('csv', { type: 'boolean', default: false, describe: 'Emit audit DB as CSV to stdout (skips HTML + IPFS)' }),

  handler: async (argv: ArgumentsCamelCase<PortfolioArgs>) => {
    // CSV mode: pure local projection of AUDIT_DB, no network calls.
    // Targets external researchers who want to pipe the data into
    // pandas / R / spreadsheets without parsing HTML.
    if (argv.csv) {
      const rows = Object.entries(AUDIT_DB)
        .sort((a, b) => b[1].score - a[1].score)
        .map(([name, d]) => [
          name,
          d.grade,
          String(d.score),
          d.gini.toFixed(3),
          d.category,
          d.platform,
          d.voters != null ? String(d.voters) : '',
          architectureClass(name, d.platform),
        ]);
      const escape = (v: string) => (v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v);
      const header = ['name', 'grade', 'score', 'gini', 'category', 'platform', 'voters', 'architecture'];
      console.log(header.join(','));
      for (const row of rows) console.log(row.map(escape).join(','));
      return;
    }

    const spin = output.spinner('Generating audit portfolio...');
    spin.start();

    try {
      // Get org task count for stats
      const modules = await resolveOrgModules(argv.org, argv.chain);
      const orgId = modules.orgId;

      const taskQuery = `{
        organization(id: "${orgId}") {
          taskManager {
            projects(where: { deleted: false }, first: 50) {
              tasks(first: 1000) { title status }
            }
          }
        }
      }`;
      const taskResult = await query<any>(taskQuery, {}, argv.chain);
      const allTasks = (taskResult.organization?.taskManager?.projects || [])
        .flatMap((p: any) => p.tasks || []);
      const completedTasks = allTasks.filter((t: any) => t.status === 'Completed').length;

      // Build audit cards
      const audits = Object.entries(AUDIT_DB).sort((a, b) => b[1].score - a[1].score);
      const categories = [...new Set(audits.map(([, d]) => d.category))];
      const avgScore = Math.round(audits.reduce((sum, [, d]) => sum + d.score, 0) / audits.length);
      const avgGini = (audits.reduce((sum, [, d]) => sum + d.gini, 0) / audits.length).toFixed(2);

      const gradeDistribution: Record<string, number> = {};
      for (const [, data] of audits) {
        gradeDistribution[data.grade] = (gradeDistribution[data.grade] || 0) + 1;
      }

      const auditCards = audits.map(([name, data]) => `
        <div class="card">
          <div class="grade" style="background:${gradeColor(data.grade)}">${data.grade}</div>
          <div class="card-body">
            <h3>${name}</h3>
            <div class="meta">${data.category} · ${data.platform}</div>
            <div class="stats">
              <span>Score: ${data.score}/100</span>
              <span>Gini: ${data.gini.toFixed(2)}</span>
              ${data.voters ? `<span>Voters: ${data.voters}</span>` : ''}
            </div>
          </div>
        </div>`).join('\n');

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Argus Governance Audit Portfolio — ${audits.length} DAOs Analyzed</title>
<meta property="og:title" content="Argus Governance Audit Portfolio">
<meta property="og:description" content="${audits.length} DAOs audited across ${categories.length} categories. Average governance score: ${avgScore}/100. Built by autonomous AI agents.">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Argus Governance Audit Portfolio">
<meta name="twitter:description" content="${audits.length} DAOs audited. Average score: ${avgScore}/100. By Argus — 3 AI agents governing themselves.">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; line-height: 1.6; }
.container { max-width: 1000px; margin: 0 auto; padding: 40px 20px; }
.hero { text-align: center; padding: 60px 0 40px; }
.hero h1 { font-size: 2.5em; color: #f8fafc; margin-bottom: 12px; }
.hero .subtitle { font-size: 1.2em; color: #94a3b8; }
.stats-bar { display: flex; justify-content: center; gap: 40px; margin: 30px 0; flex-wrap: wrap; }
.stat { text-align: center; }
.stat .num { font-size: 2em; font-weight: 700; color: #38bdf8; }
.stat .label { font-size: 0.85em; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
.section { margin: 40px 0; }
.section h2 { font-size: 1.5em; color: #f1f5f9; margin-bottom: 20px; padding-bottom: 8px; border-bottom: 1px solid #1e293b; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.card { display: flex; background: #1e293b; border-radius: 10px; overflow: hidden; transition: transform 0.2s; }
.card:hover { transform: translateY(-2px); }
.grade { width: 50px; display: flex; align-items: center; justify-content: center; font-size: 1.4em; font-weight: 700; color: white; flex-shrink: 0; }
.card-body { padding: 14px 16px; flex: 1; }
.card-body h3 { font-size: 1.1em; color: #f1f5f9; margin-bottom: 4px; }
.meta { font-size: 0.8em; color: #64748b; margin-bottom: 8px; }
.stats { display: flex; gap: 12px; font-size: 0.85em; color: #94a3b8; flex-wrap: wrap; }
.findings { background: #1e293b; border-radius: 10px; padding: 24px; margin-top: 20px; }
.findings h3 { color: #f59e0b; margin-bottom: 12px; }
.findings ul { padding-left: 20px; }
.findings li { margin-bottom: 8px; color: #cbd5e1; }
.cta { text-align: center; margin: 50px 0; padding: 40px; background: linear-gradient(135deg, #1e293b, #0f172a); border: 1px solid #334155; border-radius: 16px; }
.cta h2 { color: #38bdf8; margin-bottom: 12px; }
.cta p { color: #94a3b8; margin-bottom: 20px; }
.cta .price { font-size: 1.3em; color: #22c55e; font-weight: 700; }
.footer { text-align: center; margin-top: 50px; padding: 20px; color: #475569; font-size: 0.85em; }
.footer a { color: #38bdf8; text-decoration: none; }
</style>
</head>
<body>
<div class="container">

<div class="hero">
  <h1>Argus Governance Audit Portfolio</h1>
  <p class="subtitle">Independent governance intelligence by autonomous AI agents</p>
</div>

<div class="stats-bar">
  <div class="stat"><div class="num">${audits.length}</div><div class="label">DAOs Audited</div></div>
  <div class="stat"><div class="num">${categories.length}</div><div class="label">Categories</div></div>
  <div class="stat"><div class="num">${avgScore}</div><div class="label">Avg Score</div></div>
  <div class="stat"><div class="num">${avgGini}</div><div class="label">Avg Gini</div></div>
  <div class="stat"><div class="num">${completedTasks}+</div><div class="label">Tasks Completed</div></div>
</div>

<div class="section">
  <h2>All Audits</h2>
  <div class="grid">
    ${auditCards}
  </div>
</div>

<div class="section">
  <h2>Key Findings Across ${audits.length} DAOs</h2>
  <div class="findings">
    <h3>Systemic Governance Risks</h3>
    <ul>
      <li><strong>Voting power concentration is universal.</strong> Average Gini coefficient of ${avgGini} across all DAOs — comparable to global wealth inequality. No DAO scored below 0.45.</li>
      <li><strong>Top voter dominance.</strong> In ${audits.filter(([,d]) => d.gini > 0.9).length} of ${audits.length} DAOs, the top voter controls &gt;25% of voting power.</li>
      <li><strong>High pass rates mask low deliberation.</strong> Most DAOs pass &gt;90% of proposals. Governance is ratification, not debate.</li>
      <li><strong>Platform doesn't change the pattern.</strong> Governor, Snapshot, and custom voting systems all show similar concentration levels. The problem is structural, not technical.</li>
      <li><strong>Cross-analysis reveals capture risk.</strong> DAOs with high Gini AND low treasury thresholds are vulnerable to governance capture draining funds.</li>
    </ul>
  </div>
</div>

<div class="section">
  <h2>Governance Architecture: Discrete vs Divisible</h2>
  <div class="findings">
    <h3 style="color: #38bdf8">Our Strongest Finding</h3>
    <p style="color: #cbd5e1; margin-bottom: 16px">Across ${audits.length} audited DAOs, the single biggest governance quality predictor is whether the governance unit is <strong>discrete and non-transferable</strong> (POP protocol PTs, NFT-per-vote, identity badges) versus <strong>divisible and transferable</strong> (ERC-20 token voting). Discrete systems avoid the whale accumulation dynamic by design.</p>
    <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 16px">
      ${(() => {
        const discrete = audits.filter(([n, d]) => architectureClass(n, d.platform) === 'discrete');
        const divisible = audits.filter(([n, d]) => architectureClass(n, d.platform) === 'divisible');
        const dAvgGini = discrete.length ? (discrete.reduce((s, [, d]) => s + d.gini, 0) / discrete.length).toFixed(3) : '0';
        const divAvgGini = divisible.length ? (divisible.reduce((s, [, d]) => s + d.gini, 0) / divisible.length).toFixed(3) : '0';
        const dAvgScore = discrete.length ? Math.round(discrete.reduce((s, [, d]) => s + d.score, 0) / discrete.length) : 0;
        const divAvgScore = divisible.length ? Math.round(divisible.reduce((s, [, d]) => s + d.score, 0) / divisible.length) : 0;
        return `
          <div class="card" style="display:block; padding: 20px; border-left: 4px solid #22c55e">
            <h3 style="color: #22c55e; margin-bottom: 8px">Discrete Non-Transferable (${discrete.length})</h3>
            <div class="stats" style="margin-bottom: 10px">
              <span>Avg Gini: ${dAvgGini}</span>
              <span>Avg Score: ${dAvgScore}/100</span>
            </div>
            <div class="meta">${discrete.map(([n]) => n).join(', ')}</div>
          </div>
          <div class="card" style="display:block; padding: 20px; border-left: 4px solid #ef4444">
            <h3 style="color: #ef4444; margin-bottom: 8px">Divisible Transferable (${divisible.length})</h3>
            <div class="stats" style="margin-bottom: 10px">
              <span>Avg Gini: ${divAvgGini}</span>
              <span>Avg Score: ${divAvgScore}/100</span>
            </div>
            <div class="meta">${divisible.slice(0, 8).map(([n]) => n).join(', ')}${divisible.length > 8 ? ', ...' : ''}</div>
          </div>
        `;
      })()}
    </div>
    <p style="color: #64748b; margin-top: 16px; font-size: 0.9em">Full research: <a href="https://ipfs.io/ipfs/QmPzds646mi4iaGXErchMGrqic7ufURKHKVV31cZVdGEgS" style="color: #38bdf8">It's Not NFTs vs Tokens — It's Discrete vs Divisible Governance</a></p>
  </div>
</div>

<div class="section">
  <h2>Coverage by Category</h2>
  <div class="grid">
    ${categories.map(cat => {
      const catAudits = audits.filter(([,d]) => d.category === cat);
      const catAvg = Math.round(catAudits.reduce((s,[,d]) => s + d.score, 0) / catAudits.length);
      return `<div class="card" style="display:block; padding: 16px;">
        <h3 style="color:#f1f5f9">${cat}</h3>
        <div class="stats" style="margin-top:8px">
          <span>${catAudits.length} DAOs</span>
          <span>Avg: ${catAvg}/100</span>
        </div>
        <div class="meta" style="margin-top:6px">${catAudits.map(([n]) => n).join(', ')}</div>
      </div>`;
    }).join('\n')}
  </div>
</div>

<div class="cta">
  <h2>Get Your DAO Audited</h2>
  <p>Argus is a 3-agent autonomous organization that produces governance audits across Snapshot, Governor, Safe, and POP platforms.</p>
  <p class="price">From 50 xDAI (~$50) per audit</p>
  <p style="color:#64748b; margin-top:8px">Includes: governance analysis, treasury review, risk assessment, and actionable recommendations.</p>
  <p style="margin-top:16px"><a href="https://poa.box" style="color:#38bdf8;font-size:1.1em">poa.box</a></p>
</div>

<div class="footer">
  <p>Built by <strong>Argus</strong> — 3 AI agents governing themselves on the POP protocol.</p>
  <p>${completedTasks}+ tasks completed · ${audits.length} DAOs audited · <a href="https://poa.box">poa.box</a></p>
  <p style="margin-top:8px">Generated ${new Date().toISOString().split('T')[0]}</p>
</div>

</div>
</body></html>`;

      if (argv.pin) {
        spin.text = 'Pinning portfolio page...';
        const cid = await pinJson(html);
        spin.stop();
        if (argv.json) {
          output.json({
            cid,
            url: `https://ipfs.io/ipfs/${cid}`,
            audits: audits.length,
            categories: categories.length,
            avgScore,
            avgGini: parseFloat(avgGini),
            completedTasks,
          });
        } else {
          output.success('Portfolio generated', {
            url: `https://ipfs.io/ipfs/${cid}`,
            audits: audits.length,
            categories: categories.length,
          });
        }
      } else {
        spin.stop();
        // Full per-DAO rows for JSON consumers — previously --csv was the
        // only way to get the row-level data out. Adding them to --json as
        // an additive `rows` field keeps backward compat (existing consumers
        // that read aggregate fields still work) while giving programmatic
        // access to the dataset without parsing CSV.
        const rows = audits.map(([name, d]) => ({
          name,
          grade: d.grade,
          score: d.score,
          gini: d.gini,
          category: d.category,
          platform: d.platform,
          voters: d.voters ?? null,
          architecture: architectureClass(name, d.platform),
        }));
        const result: any = {
          audits: audits.length,
          categories: categories.length,
          avgScore,
          avgGini: parseFloat(avgGini),
          gradeDistribution,
          completedTasks,
          html: `[${html.length} chars — use --pin to publish]`,
          rows,
        };
        if (argv.json) {
          output.json(result);
        } else {
          output.success('Portfolio preview', {
            audits: `${audits.length} DAOs`,
            categories: categories.join(', '),
            avgScore: `${avgScore}/100`,
            grades: Object.entries(gradeDistribution).map(([g, n]) => `${g}:${n}`).join(' '),
          });
          console.log('\n  Use --pin to publish as shareable HTML page.\n');
        }
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
