import type { Argv, ArgumentsCamelCase } from 'yargs';
import * as output from '../../lib/output';

interface AuditFullArgs {
  org: string;
  snapshot: string;
  safe: string;
  name: string;
  chain?: number;
  pin?: boolean;
  rpc?: string;
}

export const auditFullHandler = {
  builder: (yargs: Argv) => yargs
    .option('snapshot', { type: 'string', demandOption: true, describe: 'Snapshot space ID (e.g. ens.eth)' })
    .option('safe', { type: 'string', demandOption: true, describe: 'Safe multisig address' })
    .option('name', { type: 'string', demandOption: true, describe: 'DAO name for report' })
    .option('pin', { type: 'boolean', default: false, describe: 'Pin report to IPFS' }),

  handler: async (argv: ArgumentsCamelCase<AuditFullArgs>) => {
    const spin = output.spinner(`Full audit: ${argv.name}...`);
    spin.start();

    try {
      const { execSync } = require('child_process');
      const chainId = argv.chain || 100;

      // Run governance audit
      spin.text = 'Auditing governance (Snapshot)...';
      const govJson = execSync(
        `node ${__dirname}/../../index.js org audit-snapshot --space ${argv.snapshot} --json`,
        { encoding: 'utf8', timeout: 60000, env: process.env }
      );
      const govLines = govJson.trim().split('\n');
      const govData = JSON.parse(govLines[govLines.length - 1]);

      // Run treasury audit
      spin.text = 'Auditing treasury (Safe)...';
      const treasuryJson = execSync(
        `node ${__dirname}/../../index.js org audit-safe --address ${argv.safe} --chain ${chainId} --json`,
        { encoding: 'utf8', timeout: 60000, env: process.env }
      );
      const treasuryLines = treasuryJson.trim().split('\n');
      const treasuryData = JSON.parse(treasuryLines[treasuryLines.length - 1]);

      // Cross-analysis
      spin.text = 'Cross-analyzing governance + treasury...';
      const crossRisks: string[] = [];

      const vpGini = govData.summary?.votingPowerGini || 0;
      const threshold = treasuryData.summary?.threshold || 0;
      const owners = treasuryData.summary?.owners || 0;

      if (vpGini > 0.8 && threshold === 1) {
        crossRisks.push('CRITICAL: High voting concentration AND 1-of-N treasury threshold — single entity controls both governance and funds');
      }
      if (vpGini > 0.7 && threshold < Math.ceil(owners / 2)) {
        crossRisks.push('Governance power is concentrated AND treasury threshold is below majority — governance capture could drain treasury');
      }
      if (govData.summary?.avgVotesPerProposal < 10 && treasuryData.summary?.totalTransactions > 50) {
        crossRisks.push('Low governance participation but high treasury activity — funds may be moving without adequate oversight');
      }
      if (owners > 5 && (treasuryData.summary?.activeSigners || 0) < 3) {
        crossRisks.push('Many treasury signers but few active — key-person risk for fund execution');
      }

      // Compute overall health
      let govScore = 100;
      if (vpGini > 0.9) govScore -= 40;
      else if (vpGini > 0.7) govScore -= 25;
      else if (vpGini > 0.5) govScore -= 10;
      if ((govData.summary?.avgVotesPerProposal || 0) < 10) govScore -= 20;
      if ((govData.summary?.avgVotesPerProposal || 0) < 50) govScore -= 10;
      const passRate = parseInt(govData.summary?.passRate || '0');
      if (passRate > 95) govScore -= 10;
      govScore = Math.max(0, govScore);

      let treasuryScore = 100;
      if (threshold === 1) treasuryScore -= 30;
      if (owners < 3) treasuryScore -= 20;
      if (threshold < Math.ceil(owners / 2)) treasuryScore -= 15;
      if ((treasuryData.summary?.activeSigners || 0) < owners / 2) treasuryScore -= 15;
      treasuryScore = Math.max(0, treasuryScore);

      const overallScore = Math.round((govScore + treasuryScore) / 2);
      const grade = overallScore >= 90 ? 'A' : overallScore >= 80 ? 'B' : overallScore >= 70 ? 'C' : overallScore >= 60 ? 'D' : 'F';

      const report: any = {
        dao: argv.name,
        auditor: 'Argus',
        date: new Date().toISOString().split('T')[0],
        overallScore,
        grade,
        governance: {
          score: govScore,
          space: argv.snapshot,
          proposals: govData.summary?.proposals,
          avgVotes: govData.summary?.avgVotesPerProposal,
          uniqueVoters: govData.summary?.uniqueVoters,
          vpGini: govData.summary?.votingPowerGini,
          passRate: govData.summary?.passRate,
          risks: govData.risks || [],
        },
        treasury: {
          score: treasuryScore,
          safe: argv.safe,
          owners: treasuryData.summary?.owners,
          threshold: treasuryData.summary?.threshold,
          activeSigners: treasuryData.summary?.activeSigners,
          totalUSD: treasuryData.summary?.totalUSD,
          risks: treasuryData.risks || [],
        },
        crossAnalysis: {
          risks: crossRisks,
        },
        allRisks: [...(govData.risks || []), ...(treasuryData.risks || []), ...crossRisks],
        recommendations: [...(govData.recommendations || []), ...(treasuryData.recommendations || [])],
      };

      if (argv.pin) {
        const { pinJson } = require('../../lib/ipfs');
        const cid = await pinJson(JSON.stringify(report));
        report.ipfsCid = cid;
      }

      spin.stop();

      if (argv.json) {
        output.json(report);
      } else {
        output.success(`Full DAO Audit: ${argv.name}`, {
          overallScore: `${overallScore}/100 (${grade})`,
          governance: `${govScore}/100 — ${govData.summary?.proposals} proposals, Gini ${vpGini.toFixed(2)}`,
          treasury: `${treasuryScore}/100 — ${threshold}/${owners} threshold`,
          crossRisks: crossRisks.length > 0 ? crossRisks.join('; ') : 'None',
          totalRisks: report.allRisks.length,
        });
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
