import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import { query } from '../../lib/subgraph';
import { fetchJson } from '../../lib/ipfs';
import { FETCH_ORG_FULL_DATA, GET_ORG_BY_NAME } from '../../queries/org';
import { formatAddress } from '../../lib/encoding';
import * as output from '../../lib/output';

interface ViewArgs {
  org: string;
  chain?: number;
}

export const viewHandler = {
  builder: (yargs: Argv) => yargs,

  handler: async (argv: ArgumentsCamelCase<ViewArgs>) => {
    const spin = output.spinner('Fetching organization...');
    spin.start();

    try {
      let orgId = argv.org;

      // Resolve by name if not hex
      if (!orgId.startsWith('0x')) {
        const nameResult = await query<{ organizations: Array<{ id: string }> }>(
          GET_ORG_BY_NAME,
          { name: orgId },
          argv.chain
        );
        if (!nameResult.organizations?.length) {
          spin.stop();
          output.error(`Organization "${orgId}" not found`);
          process.exit(1);
          return;
        }
        orgId = nameResult.organizations[0].id;
      }

      const result = await query<any>(FETCH_ORG_FULL_DATA, { orgId }, argv.chain);
      const org = result.organization;

      if (!org) {
        spin.stop();
        output.error(`Organization ${orgId} not found`);
        process.exit(1);
        return;
      }

      // Fetch IPFS metadata if available
      let metadata = org.metadata || null;
      if (!metadata && org.metadataHash) {
        try {
          metadata = await fetchJson(org.metadataHash);
        } catch { /* ignore */ }
      }

      spin.stop();

      if (output.isJsonMode()) {
        output.json({
          id: org.id,
          name: org.name,
          description: metadata?.description,
          template: metadata?.template,
          logo: metadata?.logo,
          links: metadata?.links,
          deployedAt: org.deployedAt,
          topHatId: org.topHatId,
          modules: {
            taskManager: org.taskManager?.id,
            hybridVoting: org.hybridVoting?.id,
            directDemocracyVoting: org.directDemocracyVoting?.id,
            participationToken: org.participationToken?.id,
            educationHub: org.educationHub?.id,
            executor: org.executorContract?.id,
            quickJoin: org.quickJoin?.id,
            eligibilityModule: org.eligibilityModule?.id,
            paymentManager: org.paymentManager?.id,
          },
          tokenInfo: org.participationToken ? {
            name: org.participationToken.name,
            symbol: org.participationToken.symbol,
            totalSupply: org.participationToken.totalSupply,
          } : null,
          votingConfig: {
            hybrid: org.hybridVoting ? {
              threshold: org.hybridVoting.thresholdPct,
              quorum: org.hybridVoting.quorum,
            } : null,
            dd: org.directDemocracyVoting ? {
              threshold: org.directDemocracyVoting.thresholdPct,
              quorum: org.directDemocracyVoting.quorum,
            } : null,
          },
          roles: (org.roles || []).map((r: any) => ({
            hatId: r.hatId,
            name: r.name,
            canVote: r.canVote,
          })),
          memberCount: (org.users || []).length,
          projectCount: (org.taskManager?.projects || []).length,
        });
      } else {
        console.log('');
        console.log(`  Organization: ${org.name || 'Unnamed'}`);
        console.log(`  ID: ${org.id}`);
        if (metadata?.description) console.log(`  Description: ${metadata.description}`);
        if (org.deployedAt) console.log(`  Deployed: ${new Date(parseInt(org.deployedAt) * 1000).toLocaleString()}`);
        console.log('');

        console.log('  Modules:');
        if (org.taskManager) console.log(`    TaskManager:   ${org.taskManager.id}`);
        if (org.hybridVoting) console.log(`    HybridVoting:  ${org.hybridVoting.id} (threshold: ${org.hybridVoting.thresholdPct}%, quorum: ${org.hybridVoting.quorum}%)`);
        if (org.directDemocracyVoting) console.log(`    DD Voting:     ${org.directDemocracyVoting.id} (threshold: ${org.directDemocracyVoting.thresholdPct}%, quorum: ${org.directDemocracyVoting.quorum}%)`);
        if (org.participationToken) console.log(`    Token:         ${org.participationToken.name} (${org.participationToken.symbol}), supply: ${ethers.utils.formatUnits(org.participationToken.totalSupply || '0', 18)}`);
        if (org.executorContract) console.log(`    Executor:      ${org.executorContract.id}`);
        if (org.quickJoin) console.log(`    QuickJoin:     ${org.quickJoin.id}`);
        if (org.educationHub) console.log(`    EducationHub:  ${org.educationHub.id}`);
        if (org.eligibilityModule) console.log(`    Eligibility:   ${org.eligibilityModule.id}`);
        if (org.paymentManager) console.log(`    Payments:      ${org.paymentManager.id}`);
        console.log('');

        if (org.roles?.length) {
          console.log('  Roles:');
          for (const role of org.roles) {
            console.log(`    - ${role.name || 'Unnamed'} (hat: ${role.hatId}, vote: ${role.canVote ? 'yes' : 'no'})`);
          }
          console.log('');
        }

        console.log(`  Members: ${(org.users || []).length}`);
        console.log(`  Projects: ${(org.taskManager?.projects || []).length}`);

        if (metadata?.links?.length) {
          console.log('  Links:');
          for (const link of metadata.links) {
            console.log(`    - ${link.name}: ${link.url}`);
          }
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
