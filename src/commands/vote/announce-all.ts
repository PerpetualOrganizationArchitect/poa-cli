import type { Argv, ArgumentsCamelCase } from 'yargs';
import { createSigner } from '../../lib/signer';
import { createWriteContract } from '../../lib/contracts';
import { executeTx } from '../../lib/tx';
import { resolveOrgId } from '../../lib/resolve';
import { query } from '../../lib/subgraph';
import { FETCH_VOTING_DATA } from '../../queries/voting';
import * as output from '../../lib/output';
import { resolveVotingContracts } from './helpers';

interface AnnounceAllArgs {
  org: string;
  chain?: number;
  rpc?: string;
  'private-key'?: string;
  'dry-run'?: boolean;
}

export const announceAllHandler = {
  builder: (yargs: Argv) => yargs,

  handler: async (argv: ArgumentsCamelCase<AnnounceAllArgs>) => {
    const spin = output.spinner('Checking for ended proposals...');
    spin.start();

    try {
      const orgId = await resolveOrgId(argv.org, argv.chain);
      const result = await query<any>(FETCH_VOTING_DATA, { orgId }, argv.chain);
      const org = result.organization;

      if (!org) throw new Error('Organization not found');

      // Find all Ended proposals (not yet announced/executed)
      const toAnnounce: Array<{ id: string; type: 'hybrid' | 'dd'; title: string }> = [];

      const now = Math.floor(Date.now() / 1000);

      // Find proposals that are ready to announce:
      // - Status "Ended" (subgraph updated), OR
      // - Status "Active" but endTimestamp has passed (subgraph hasn't updated yet)
      // Exclude "Executed" (already announced)
      const hybridProposals = org.hybridVoting?.proposals || [];
      for (const p of hybridProposals) {
        const ended = p.status === 'Ended' ||
          (p.status === 'Active' && p.endTimestamp && parseInt(p.endTimestamp) < now);
        if (ended) {
          toAnnounce.push({ id: p.proposalId, type: 'hybrid', title: p.title || `Proposal #${p.proposalId}` });
        }
      }

      const ddProposals = org.directDemocracyVoting?.ddvProposals || [];
      for (const p of ddProposals) {
        const ended = p.status === 'Ended' ||
          (p.status === 'Active' && p.endTimestamp && parseInt(p.endTimestamp) < now);
        if (ended) {
          toAnnounce.push({ id: p.proposalId, type: 'dd', title: p.title || `DD Proposal #${p.proposalId}` });
        }
      }

      if (toAnnounce.length === 0) {
        spin.stop();
        if (output.isJsonMode()) {
          output.json({ announced: 0, proposals: [] });
        } else {
          output.info('No ended proposals to announce');
        }
        return;
      }

      const contracts = await resolveVotingContracts(argv.org, argv.chain);
      const { signer } = createSigner({ privateKey: argv.privateKey as string, chainId: argv.chain, rpcUrl: argv.rpc as string });

      spin.text = `Announcing ${toAnnounce.length} proposal(s)...`;

      const results: Array<{ id: string; type: string; title: string; success: boolean; txHash?: string; error?: string }> = [];

      for (const proposal of toAnnounce) {
        const isHybrid = proposal.type === 'hybrid';
        const contractAddr = isHybrid ? contracts.hybridVotingAddress : contracts.ddVotingAddress;
        if (!contractAddr) {
          results.push({ ...proposal, success: false, error: `No ${proposal.type} voting contract` });
          continue;
        }

        const abiName = isHybrid ? 'HybridVotingNew' : 'DirectDemocracyVotingNew';
        const contract = createWriteContract(contractAddr, abiName, signer);

        spin.text = `Announcing #${proposal.id}: ${proposal.title}...`;
        const txResult = await executeTx(contract, 'announceWinner', [proposal.id], { dryRun: argv.dryRun });

        if (txResult.success) {
          const winnerEvent = txResult.logs?.find(l => l.name === 'Winner');
          results.push({
            ...proposal,
            success: true,
            txHash: txResult.txHash,
          });
        } else {
          results.push({ ...proposal, success: false, error: txResult.error });
        }
      }

      spin.stop();

      if (output.isJsonMode()) {
        output.json({ announced: results.filter(r => r.success).length, proposals: results });
      } else {
        console.log('');
        for (const r of results) {
          if (r.success) {
            console.log(`  \x1b[32m✓\x1b[0m #${r.id} ${r.title}`);
          } else {
            console.log(`  \x1b[31m✗\x1b[0m #${r.id} ${r.title} — ${r.error}`);
          }
        }
        const ok = results.filter(r => r.success).length;
        console.log(`\n  ${ok}/${results.length} proposals announced.`);
        console.log('');
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
