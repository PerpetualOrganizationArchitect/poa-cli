import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';
import { query } from '../../lib/subgraph';
import { resolveOrgModules } from '../../lib/resolve';
import { resolveNetworkConfig } from '../../config/networks';
import { createReadContract } from '../../lib/contracts';
import { resolveVotingContracts } from '../vote/helpers';
import * as output from '../../lib/output';

interface TriageArgs {
  org?: string;
  chain?: number;
  rpc?: string;
  'private-key'?: string;
}

interface Action {
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  type: string;
  detail: string;
  data?: any;
}

const FETCH_TRIAGE_DATA = `
  query FetchTriageData($orgId: Bytes!) {
    organization(id: $orgId) {
      name
      participationToken { totalSupply }
      users(first: 100) {
        address
        participationTokenBalance
        membershipStatus
        totalTasksCompleted
        account { username }
      }
      hybridVoting {
        proposals(first: 100) {
          proposalId
          title
          status
          endTimestamp
          winningOption
          votes { voter }
        }
      }
      taskManager {
        projects(where: { deleted: false }, first: 100) {
          tasks(first: 1000) {
            taskId
            title
            status
            assignee
            assigneeUsername
            rejectionCount
          }
        }
      }
      paymentManager {
        distributions(where: { status: "Active" }, first: 20) {
          distributionId
          claims { claimer }
        }
      }
    }
  }
`;

export const triageHandler = {
  builder: (yargs: Argv) => yargs,

  handler: async (argv: ArgumentsCamelCase<TriageArgs>) => {
    const spin = output.spinner('Running triage...');
    spin.start();

    try {
      // --- Gather data ---
      const key = argv.privateKey as string || process.env.POP_PRIVATE_KEY;
      if (!key) throw new Error('No private key configured');
      const wallet = new ethers.Wallet(key);
      const myAddr = wallet.address.toLowerCase();

      const modules = await resolveOrgModules(argv.org, argv.chain);
      const networkConfig = resolveNetworkConfig(argv.chain);
      const provider = new ethers.providers.JsonRpcProvider(networkConfig.resolvedRpc);

      const [gasBalance, orgData] = await Promise.all([
        provider.getBalance(wallet.address),
        query<any>(FETCH_TRIAGE_DATA, { orgId: modules.orgId }, argv.chain),
      ]);

      const org = orgData.organization;
      if (!org) throw new Error('Organization not found');

      const now = Math.floor(Date.now() / 1000);
      const actions: Action[] = [];
      const changes: Action[] = [];

      // --- Load last known state for change detection ---
      const orgStatePath = path.join(homedir(), '.pop-agent', 'brain', 'Memory', 'org-state.md');
      let lastState = '';
      try { lastState = fs.readFileSync(orgStatePath, 'utf8'); } catch {}

      const activeMembers = org.users.filter((u: any) => u.membershipStatus === 'Active');
      const totalSupply = ethers.utils.formatEther(org.participationToken?.totalSupply || '0');
      const allTasks = (org.taskManager?.projects || []).flatMap((p: any) => p.tasks || []);
      const proposals = org.hybridVoting?.proposals || [];

      // --- 1. BLOCKERS (CRITICAL) ---

      // Gas check
      const gasEther = parseFloat(ethers.utils.formatEther(gasBalance));
      if (gasEther < 0.01) {
        actions.push({ priority: 'CRITICAL', type: 'gas', detail: `Gas critically low: ${gasEther.toFixed(4)} ${networkConfig.nativeCurrency.symbol}. Fund wallet immediately.` });
      } else if (gasEther < 0.1) {
        actions.push({ priority: 'HIGH', type: 'gas', detail: `Gas low: ${gasEther.toFixed(3)} ${networkConfig.nativeCurrency.symbol}. Consider refueling.` });
      }

      // Rejected tasks
      const myRejected = allTasks.filter((t: any) =>
        t.assignee?.toLowerCase() === myAddr &&
        t.status === 'Assigned' &&
        parseInt(t.rejectionCount || '0') > 0
      );
      for (const t of myRejected) {
        actions.push({ priority: 'CRITICAL', type: 'rejected', detail: `Task #${t.taskId} "${t.title}" was rejected (${t.rejectionCount}x). Fix and re-submit before new work.`, data: { taskId: t.taskId } });
      }

      // --- 2. QUEUE (HIGH) ---

      // Expired proposals needing announce (with callStatic to filter zombies)
      const expiredCandidates = proposals.filter((p: any) =>
        p.status === 'Active' &&
        p.winningOption == null &&
        p.endTimestamp && parseInt(p.endTimestamp) < now
      );
      if (expiredCandidates.length > 0) {
        try {
          const votingContracts = await resolveVotingContracts(argv.org as string, argv.chain);
          const hybridAddr = votingContracts.hybridVotingAddress;
          if (hybridAddr) {
            const votingContract = createReadContract(hybridAddr, 'HybridVotingNew', provider);
            for (const p of expiredCandidates) {
              try {
                await votingContract.callStatic.announceWinner(p.proposalId);
                // callStatic succeeded — this proposal CAN be announced
                actions.push({ priority: 'HIGH', type: 'announce', detail: `Proposal #${p.proposalId} "${p.title}" expired — run announce-all.`, data: { proposalId: p.proposalId } });
              } catch {
                // callStatic failed — zombie proposal, skip silently
              }
            }
          }
        } catch {
          // Voting contract resolution failed — fall back to listing all expired
          for (const p of expiredCandidates) {
            actions.push({ priority: 'HIGH', type: 'announce', detail: `Proposal #${p.proposalId} "${p.title}" expired — run announce-all.`, data: { proposalId: p.proposalId } });
          }
        }
      }

      // Unvoted proposals
      const activeProposals = proposals.filter((p: any) =>
        p.status === 'Active' && p.winningOption == null && !(parseInt(p.endTimestamp) < now)
      );
      for (const p of activeProposals) {
        const hasVoted = (p.votes || []).some((v: any) => v.voter?.toLowerCase() === myAddr);
        if (!hasVoted) {
          const minutesLeft = p.endTimestamp ? Math.floor((parseInt(p.endTimestamp) - now) / 60) : Infinity;
          const urgency = minutesLeft < 60 ? 'CRITICAL' : minutesLeft < 360 ? 'HIGH' : 'MEDIUM';
          actions.push({ priority: urgency as any, type: 'vote', detail: `Proposal #${p.proposalId} "${p.title}" — unvoted, ${minutesLeft < 60 ? minutesLeft + ' min left!' : Math.floor(minutesLeft / 60) + 'h left'}.`, data: { proposalId: p.proposalId, minutesLeft } });
        }
      }

      // Pending reviews (submitted by others)
      const pendingReviews = allTasks.filter((t: any) =>
        t.status === 'Submitted' && t.assignee?.toLowerCase() !== myAddr
      );
      for (const t of pendingReviews) {
        actions.push({ priority: 'HIGH', type: 'review', detail: `Task #${t.taskId} "${t.title}" by ${t.assigneeUsername || 'unknown'} — needs review.`, data: { taskId: t.taskId } });
      }

      // Unclaimed distributions
      const unclaimedDist = (org.paymentManager?.distributions || []).filter((d: any) =>
        !(d.claims || []).some((c: any) => c.claimer?.toLowerCase() === myAddr)
      );
      if (unclaimedDist.length > 0) {
        actions.push({ priority: 'HIGH', type: 'claim', detail: `${unclaimedDist.length} unclaimed distribution(s) — run claim-mine.` });
      }

      // --- 3. WORK (MEDIUM) ---

      // My assigned tasks
      const myAssigned = allTasks.filter((t: any) =>
        t.assignee?.toLowerCase() === myAddr && t.status === 'Assigned' && parseInt(t.rejectionCount || '0') === 0
      );
      for (const t of myAssigned) {
        actions.push({ priority: 'MEDIUM', type: 'work', detail: `Task #${t.taskId} "${t.title}" assigned to you.`, data: { taskId: t.taskId } });
      }

      // Open tasks available to claim
      const openTasks = allTasks.filter((t: any) => t.status === 'Open');
      if (openTasks.length > 0) {
        actions.push({ priority: 'MEDIUM', type: 'claim-task', detail: `${openTasks.length} open task(s) available to claim.`, data: { tasks: openTasks.map((t: any) => ({ id: t.taskId, title: t.title })) } });
      }

      // --- 4. PLAN (LOW) ---

      const hasWork = myAssigned.length > 0 || openTasks.length > 0 || pendingReviews.length > 0;
      if (!hasWork && expiredCandidates.length === 0 && myRejected.length === 0) {
        actions.push({ priority: 'LOW', type: 'plan', detail: 'Board is empty — planning mandatory. Read goals.md, create tasks, explore capabilities.' });
      }

      // --- 5. CHANGE DETECTION ---

      // New members
      const memberNames = activeMembers.map((u: any) => u.account?.username || u.address.slice(0, 10));
      for (const name of memberNames) {
        if (lastState && !lastState.includes(name)) {
          changes.push({ priority: 'INFO', type: 'member_joined', detail: `New member: ${name}` });
        }
      }

      // PT milestones
      const ptNum = parseFloat(totalSupply);
      const milestones = [100, 250, 500, 1000, 2000, 5000];
      for (const m of milestones) {
        if (ptNum >= m && lastState && !lastState.includes(`${m}`)) {
          // Rough check — could false-positive but better than nothing
        }
      }

      // Proposal state changes
      const executedProposals = proposals.filter((p: any) => p.status === 'Executed');
      for (const p of executedProposals) {
        if (lastState && !lastState.includes(`#${p.proposalId}`)) {
          changes.push({ priority: 'INFO', type: 'proposal_executed', detail: `Proposal #${p.proposalId} "${p.title}" was executed.` });
        }
      }

      // Sort actions by priority
      const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
      actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

      spin.stop();

      // --- Output ---
      const context = {
        gas: `${gasEther.toFixed(3)} ${networkConfig.nativeCurrency.symbol}`,
        gasStatus: gasEther < 0.01 ? 'CRITICAL' : gasEther < 0.1 ? 'LOW' : 'HEALTHY',
        members: activeMembers.length,
        ptSupply: Math.round(ptNum),
        pendingVotes: actions.filter(a => a.type === 'vote').length,
        pendingReviews: pendingReviews.length,
        rejectedTasks: myRejected.length,
        openTasks: openTasks.length,
        assignedTasks: myAssigned.length,
        boardState: hasWork ? 'has-work' : 'empty',
      };

      if (output.isJsonMode()) {
        output.json({ actions, changes, context });
      } else {
        console.log('');
        console.log('  Agent Triage');
        console.log('  ════════════');

        if (actions.length === 0) {
          console.log('  No actions needed.');
        } else {
          for (const a of actions) {
            const icon = a.priority === 'CRITICAL' ? '\x1b[31m!!\x1b[0m' :
                         a.priority === 'HIGH' ? '\x1b[33m!\x1b[0m' :
                         a.priority === 'MEDIUM' ? '\x1b[36m·\x1b[0m' :
                         a.priority === 'LOW' ? '\x1b[90m○\x1b[0m' : '\x1b[90mℹ\x1b[0m';
            console.log(`  ${icon} [${a.priority}] ${a.detail}`);
          }
        }

        if (changes.length > 0) {
          console.log('');
          console.log('  Changes since last heartbeat:');
          for (const c of changes) {
            console.log(`    △ ${c.detail}`);
          }
        }

        console.log('');
        console.log(`  Context: ${context.members} members | ${context.ptSupply} PT | Gas: ${context.gas} (${context.gasStatus}) | Board: ${context.boardState}`);
        console.log('');
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
