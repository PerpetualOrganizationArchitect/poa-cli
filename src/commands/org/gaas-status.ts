import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import { resolveNetworkConfig } from '../../config/networks';
import { query } from '../../lib/subgraph';
import { resolveOrgModules } from '../../lib/resolve';
import * as output from '../../lib/output';

interface GaasStatusArgs {
  org: string;
  chain?: number;
  rpc?: string;
}

export const gaasStatusHandler = {
  builder: (yargs: Argv) => yargs,

  handler: async (argv: ArgumentsCamelCase<GaasStatusArgs>) => {
    const spin = output.spinner('Checking GaaS pipeline...');
    spin.start();

    try {
      const modules = await resolveOrgModules(argv.org, argv.chain);
      const orgId = modules.orgId;

      // Count audit-related tasks
      spin.text = 'Counting audits...';
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

      const auditTasks = allTasks.filter((t: any) =>
        /audit|leaderboard|governance.*report/i.test(t.title || '')
      );
      const outreachTasks = allTasks.filter((t: any) =>
        /outreach|forum|reddit|thread|distribution/i.test(t.title || '')
      );
      const completedAudits = auditTasks.filter((t: any) => t.status === 'Completed').length;
      const completedOutreach = outreachTasks.filter((t: any) => t.status === 'Completed').length;

      // Check treasury for external revenue
      spin.text = 'Checking revenue...';
      const config = resolveNetworkConfig(argv.chain);
      const provider = new ethers.providers.JsonRpcProvider(config.resolvedRpc, config.chainId);
      const executor = modules.executorAddress || '0x9116bb47ef766cd867151fee8823e662da3bdad9';

      // Look for ERC20 transfers TO executor in last 500k blocks
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 500000);
      const transferTopic = ethers.utils.id('Transfer(address,address,uint256)');
      const executorTopic = ethers.utils.hexZeroPad(executor, 32);

      let externalTransfers = 0;
      try {
        const logs = await provider.getLogs({
          fromBlock, toBlock: currentBlock,
          topics: [transferTopic, null, executorTopic],
        });

        // Filter out internal addresses (PaymentManager, Curve pool, etc)
        const internalAddrs = new Set([
          '0x409f51250dc5c66bb1d6952f947d841192f1140e', // PaymentManager
          '0xf3d8f3de71657d342db60dd714c8a2ae37eac6b4', // Curve pool
          '0x0000000000000000000000000000000000000000', // zero (mints)
        ].map(a => a.toLowerCase()));

        for (const log of logs) {
          const from = ('0x' + log.topics[1].slice(26)).toLowerCase();
          if (!internalAddrs.has(from)) externalTransfers++;
        }
      } catch { /* can't scan — skip */ }

      // Pipeline stage
      let stage = 'producing';
      if (completedOutreach > 0) stage = 'distributing';
      if (externalTransfers > 0) stage = 'earning';

      const result: any = {
        pipeline: stage,
        audits: {
          total: completedAudits,
          inProgress: auditTasks.length - completedAudits,
        },
        distribution: {
          outreachCompleted: completedOutreach,
          pieces: [
            { name: 'r/defi post', channel: 'reddit', status: 'READY — no credentials needed to post', cid: 'QmdoQCHAuh6cdowsHGUYB5zMrV2iyhTMS4U2kv1mPFsqux' },
            { name: 'Gitcoin forum post', channel: 'gov.gitcoin.co', status: 'READY — needs Discourse signup', cid: 'QmT9maoVj3r2qtyRomMra5fyyqvChVCMD61gjyw7o444xd' },
            { name: 'Balancer forum post', channel: 'forum.balancer.fi', status: 'READY — needs Discourse signup', cid: 'QmT9maoVj3r2qtyRomMra5fyyqvChVCMD61gjyw7o444xd' },
            { name: 'X/Twitter thread (9 tweets)', channel: 'x.com', status: process.env.X_API_KEY ? 'READY — use /post-thread' : 'READY — needs X API creds', cid: 'QmTnbbWnfKSekX9q9v9gkUZfVrnaDZEnbuLjp5xJ3GrscU' },
            { name: 'State of DAO Governance blog', channel: 'mirror/medium/substack', status: 'READY — needs platform account', cid: 'QmNg9WbfbWskuRmATBhrj6KxDj9ZCwY15ZbFhBqMjZAxzP' },
            { name: 'Personal blog (155 Heartbeats)', channel: 'mirror/medium/substack', status: 'READY — needs platform account', cid: 'QmfWEhz2pqo3V4GDdRoRNhcCowtMqZSZoKWV791iydjKPb' },
          ],
        },
        revenue: {
          externalTransfers,
          status: externalTransfers > 0 ? 'REVENUE!' : 'No external payments yet',
        },
        links: {
          masterIndex: 'https://ipfs.io/ipfs/QmY7tFNeA8viNSc8AV3e6boLLPaL3i8My7AVReBVdWg1UU',
          pricing: 'https://ipfs.io/ipfs/QmQTWkDhm849gkumSZwtzebMHpM4GVQeqjyKvouvXaBFKt',
          portfolio: 'https://ipfs.io/ipfs/QmXMmGhWYtoYgwyoHF7KhdxemqtMekYGHVRzhyxUdkhUUZ',
          leaderboard: 'https://ipfs.io/ipfs/QmUD9GPveEHbz9thYjF1nBvGjREFC7ThELr8T64ubZ1TUf',
        },
      };

      spin.stop();

      if (argv.json) {
        output.json(result);
      } else {
        console.log(`\n  GaaS Pipeline Status: ${stage.toUpperCase()}`);
        console.log('  ' + '═'.repeat(50));
        console.log(`  Audits completed: ${completedAudits}`);
        console.log(`  Outreach delivered: ${completedOutreach}`);
        console.log(`  Revenue: ${externalTransfers > 0 ? externalTransfers + ' external transfers!' : 'None yet'}`);
        console.log('');
        console.log('  Distribution Readiness:');
        for (const p of result.distribution.pieces) {
          const icon = p.status.startsWith('READY') ? '✓' : '○';
          console.log(`    ${icon} ${p.name} → ${p.channel}: ${p.status}`);
        }
        console.log('');
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
