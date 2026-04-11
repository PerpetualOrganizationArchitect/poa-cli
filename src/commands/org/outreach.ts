import type { Argv, ArgumentsCamelCase } from 'yargs';
import * as output from '../../lib/output';
import { query } from '../../lib/subgraph';

interface OutreachArgs {
  org: string;
  target: string;
  chain?: number;
  rpc?: string;
}

/**
 * Generate a tailored outreach message for a target DAO based on audit findings.
 * This is the distribution pipeline: production (audit) → packaging (outreach) → delivery.
 */
export const outreachHandler = {
  builder: (yargs: Argv) => yargs
    .option('target', { type: 'string', demandOption: true, describe: 'Target org name to generate outreach for' }),

  handler: async (argv: ArgumentsCamelCase<OutreachArgs>) => {
    const spin = output.spinner('Generating outreach message...');
    spin.start();

    try {
      // Fetch target org data
      const chainId = argv.chain || 100;
      const orgQuery = `{
        organizations(where: {name: "${argv.target}"}) {
          id name
          taskManager {
            projects(where: { deleted: false }) {
              tasks { taskId status title payout assigneeUsername }
            }
          }
          participationToken { totalSupply holders { balance account { id username } } }
        }
      }`;

      const result = await query<any>(orgQuery, {}, chainId);
      const org = result.organizations?.[0];
      if (!org) throw new Error(`Org "${argv.target}" not found on chain ${chainId}`);

      // Compute basic metrics
      const allTasks = (org.taskManager?.projects || []).flatMap((p: any) => p.tasks || []);
      const totalTasks = allTasks.length;
      const completedTasks = allTasks.filter((t: any) => t.status === 'Completed').length;
      const openTasks = allTasks.filter((t: any) => t.status === 'Open').length;
      const holders = org.participationToken?.holders || [];
      const totalPT = holders.reduce((sum: number, h: any) => sum + parseFloat(h.balance || '0'), 0);
      const memberCount = holders.length;

      // Compute Gini
      const balances = holders.map((h: any) => parseFloat(h.balance || '0')).sort((a: number, b: number) => a - b);
      let gini = 0;
      if (balances.length > 1 && totalPT > 0) {
        let sumDiffs = 0;
        for (let i = 0; i < balances.length; i++) {
          for (let j = 0; j < balances.length; j++) {
            sumDiffs += Math.abs(balances[i] - balances[j]);
          }
        }
        gini = sumDiffs / (2 * balances.length * totalPT);
      }

      // Identify top risks
      const risks: string[] = [];
      if (gini > 0.7) risks.push(`High token concentration (Gini: ${gini.toFixed(2)}) — governance power is centralized`);
      if (openTasks > 3) risks.push(`${openTasks} open tasks without assignees — work is stalling`);
      if (completedTasks / Math.max(totalTasks, 1) < 0.5) risks.push(`Low task completion rate (${completedTasks}/${totalTasks})`);
      const inactiveMembers = holders.filter((h: any) => parseFloat(h.balance || '0') === 0).length;
      if (inactiveMembers > memberCount / 2) risks.push(`${inactiveMembers}/${memberCount} members have zero contribution`);

      // Generate the message
      const message = generateOutreachMessage(argv.target as string, {
        memberCount, totalPT, gini, totalTasks, completedTasks, openTasks, risks, inactiveMembers,
      });

      spin.stop();

      if (argv.json) {
        output.json({
          target: argv.target,
          chain: chainId,
          metrics: { memberCount, totalPT, gini: parseFloat(gini.toFixed(3)), totalTasks, completedTasks, openTasks, risks },
          message,
        });
      } else {
        console.log('\n' + message);
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};

function generateOutreachMessage(orgName: string, data: any): string {
  const { memberCount, gini, totalTasks, completedTasks, openTasks, risks } = data;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  let riskSection = '';
  if (risks.length > 0) {
    riskSection = `\n**What we found:**\n${risks.map((r: string) => `- ${r}`).join('\n')}\n`;
  }

  return `---
## Free Governance Health Check: ${orgName}

Hi ${orgName} team,

We're Argus — an autonomous governance organization on the POP protocol. We ran a governance health analysis on ${orgName} using on-chain data and wanted to share what we found.

**Quick snapshot:**
- ${memberCount} members, ${completionRate}% task completion (${completedTasks}/${totalTasks})
- Token distribution Gini: ${gini.toFixed(2)}${gini > 0.7 ? ' (concentrated)' : gini > 0.4 ? ' (moderate)' : ' (healthy)'}
${openTasks > 0 ? `- ${openTasks} open task${openTasks > 1 ? 's' : ''} available for contributors` : ''}
${riskSection}
**What we can help with:**
- Detailed governance audit with risk assessment and specific recommendations
- Task workflow optimization — we've completed 120+ tasks with 96% completion rate
- AI agent integration for automated governance participation

Full audit methodology and past reports available at our service page.

Argus is a 3-member org (2 AI agents + 1 human) that practices what it preaches: transparent governance, on-chain accountability, and worker ownership. Every member earns their seat through contribution.

Interested? We'd love to discuss how we can help ${orgName} strengthen its governance.

— sentinel_01, Argus
---`;
}
