import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import { createSigner } from '../../lib/signer';
import { createWriteContract } from '../../lib/contracts';
import { executeTx } from '../../lib/tx';
import { query } from '../../lib/subgraph';
import { resolveOrgModules } from '../../lib/resolve';
import * as output from '../../lib/output';
import { resolveTreasuryContracts } from './helpers';

interface ClaimMineArgs {
  org?: string;
  chain?: number;
  rpc?: string;
  'private-key'?: string;
  'dry-run'?: boolean;
}

// OZ v5 double-hash leaf
function hashLeaf(address: string, amount: ethers.BigNumber): string {
  const inner = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(['address', 'uint256'], [address, amount])
  );
  return ethers.utils.keccak256(inner);
}

function hashPair(a: string, b: string): string {
  const [left, right] = a < b ? [a, b] : [b, a];
  return ethers.utils.solidityKeccak256(['bytes32', 'bytes32'], [left, right]);
}

function buildTree(leaves: string[]): string[][] {
  const sorted = [...leaves].sort();
  const layers: string[][] = [sorted];
  let current = sorted;
  while (current.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < current.length; i += 2) {
      if (i + 1 < current.length) {
        next.push(hashPair(current[i], current[i + 1]));
      } else {
        next.push(current[i]);
      }
    }
    layers.push(next);
    current = next;
  }
  return layers;
}

function getProof(layers: string[][], leaf: string): string[] {
  const proof: string[] = [];
  let index = layers[0].indexOf(leaf);
  if (index === -1) return [];
  for (let i = 0; i < layers.length - 1; i++) {
    const siblingIndex = index % 2 === 1 ? index - 1 : index + 1;
    if (siblingIndex < layers[i].length) proof.push(layers[i][siblingIndex]);
    index = Math.floor(index / 2);
  }
  return proof;
}

const FETCH_MEMBERS_AT_BLOCK = `
  query FetchMembersAtBlock($orgId: Bytes!, $block: Int!) {
    organization(id: $orgId, block: { number: $block }) {
      participationToken { totalSupply }
      users(orderBy: participationTokenBalance, orderDirection: desc, first: 1000) {
        address
        participationTokenBalance
        membershipStatus
      }
    }
  }
`;

const FETCH_DISTRIBUTIONS = `
  query FetchDistributions($orgId: Bytes!) {
    organization(id: $orgId) {
      paymentManager {
        distributions(where: { status: "Active" }, first: 50) {
          distributionId
          totalAmount
          merkleRoot
          checkpointBlock
          payoutToken
          claims { claimer }
        }
      }
    }
  }
`;

export const claimMineHandler = {
  builder: (yargs: Argv) => yargs,

  handler: async (argv: ArgumentsCamelCase<ClaimMineArgs>) => {
    const spin = output.spinner('Checking claimable distributions...');
    spin.start();

    try {
      const key = argv.privateKey as string || process.env.POP_PRIVATE_KEY;
      if (!key) throw new Error('No private key configured');
      const { signer, address: myAddr } = createSigner({ privateKey: key, chainId: argv.chain, rpcUrl: argv.rpc as string });
      const myAddrLower = myAddr.toLowerCase();

      const modules = await resolveOrgModules(argv.org, argv.chain);
      const { paymentManagerAddress } = await resolveTreasuryContracts(argv.org, argv.chain);

      // Get active distributions
      const distResult = await query<any>(FETCH_DISTRIBUTIONS, { orgId: modules.orgId }, argv.chain);
      const distributions = distResult.organization?.paymentManager?.distributions || [];

      if (distributions.length === 0) {
        spin.stop();
        if (output.isJsonMode()) output.json({ claimed: 0, distributions: [] });
        else output.info('No active distributions to claim from');
        return;
      }

      const results: Array<{ distId: string; amount: string; success: boolean; txHash?: string; error?: string }> = [];

      for (const dist of distributions) {
        // Skip if already claimed
        const alreadyClaimed = (dist.claims || []).some((c: any) => c.claimer?.toLowerCase() === myAddrLower);
        if (alreadyClaimed) continue;

        spin.text = `Recomputing merkle tree for distribution #${dist.distributionId}...`;

        // Get PT balances at checkpoint block
        const membersResult = await query<any>(FETCH_MEMBERS_AT_BLOCK, {
          orgId: modules.orgId,
          block: parseInt(dist.checkpointBlock),
        }, argv.chain);

        const org = membersResult.organization;
        if (!org) continue;

        const activeMembers = org.users.filter((u: any) =>
          u.membershipStatus === 'Active' &&
          ethers.BigNumber.from(u.participationTokenBalance).gt(0)
        );

        const totalAmount = ethers.BigNumber.from(dist.totalAmount);
        const eligiblePT = activeMembers.reduce(
          (sum: ethers.BigNumber, m: any) => sum.add(ethers.BigNumber.from(m.participationTokenBalance)),
          ethers.BigNumber.from(0)
        );

        // Compute allocations
        const allocs = activeMembers.map((m: any) => {
          const pt = ethers.BigNumber.from(m.participationTokenBalance);
          return {
            address: ethers.utils.getAddress(m.address),
            amount: totalAmount.mul(pt).div(eligiblePT),
          };
        });

        // Dust fix
        const allocated = allocs.reduce((s: ethers.BigNumber, a: any) => s.add(a.amount), ethers.BigNumber.from(0));
        const dust = totalAmount.sub(allocated);
        if (dust.gt(0) && allocs.length > 0) allocs[0].amount = allocs[0].amount.add(dust);

        // Build merkle tree
        const leaves = allocs.map((a: any) => hashLeaf(a.address, a.amount));
        const layers = buildTree(leaves);
        const computedRoot = layers[layers.length - 1][0];

        // Verify root matches on-chain
        if (computedRoot !== dist.merkleRoot) {
          results.push({ distId: dist.distributionId, amount: '0', success: false, error: 'Root mismatch — different allocation parameters' });
          continue;
        }

        // Find my allocation
        const myAlloc = allocs.find((a: any) => a.address.toLowerCase() === myAddrLower);
        if (!myAlloc || myAlloc.amount.isZero()) {
          results.push({ distId: dist.distributionId, amount: '0', success: false, error: 'No allocation for this address' });
          continue;
        }

        const myLeaf = hashLeaf(myAlloc.address, myAlloc.amount);
        const proof = getProof(layers, myLeaf);

        spin.text = `Claiming ${ethers.utils.formatEther(myAlloc.amount)} from distribution #${dist.distributionId}...`;

        const pm = createWriteContract(paymentManagerAddress, 'PaymentManager', signer);
        const txResult = await executeTx(
          pm,
          'claimDistribution',
          [dist.distributionId, myAlloc.amount, proof],
          { dryRun: argv.dryRun }
        );

        if (txResult.success) {
          results.push({
            distId: dist.distributionId,
            amount: ethers.utils.formatEther(myAlloc.amount),
            success: true,
            txHash: txResult.txHash,
          });
        } else {
          results.push({
            distId: dist.distributionId,
            amount: ethers.utils.formatEther(myAlloc.amount),
            success: false,
            error: txResult.error,
          });
        }
      }

      spin.stop();

      if (output.isJsonMode()) {
        output.json({ claimed: results.filter(r => r.success).length, distributions: results });
      } else {
        if (results.length === 0) {
          output.info('No unclaimed distributions found');
        } else {
          console.log('');
          for (const r of results) {
            if (r.success) {
              console.log(`  \x1b[32m✓\x1b[0m Distribution #${r.distId}: claimed ${r.amount} tokens`);
            } else {
              console.log(`  \x1b[31m✗\x1b[0m Distribution #${r.distId}: ${r.error}`);
            }
          }
          const ok = results.filter(r => r.success).length;
          console.log(`\n  ${ok}/${results.length} claimed.`);
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
