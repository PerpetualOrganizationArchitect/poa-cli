import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import * as fs from 'fs';
import { query } from '../../lib/subgraph';
import { resolveOrgModules } from '../../lib/resolve';
import { resolveNetworkConfig } from '../../config/networks';
import * as output from '../../lib/output';

interface ComputeMerkleArgs {
  org?: string;
  chain?: number;
  amount: string;
  token: string;
  output?: string;
}

interface MemberAllocation {
  address: string;
  username: string | null;
  ptBalance: string;
  share: string;
  allocation: string;
}

interface MerkleResult {
  merkleRoot: string;
  totalAmount: string;
  tokenAddress: string;
  checkpointBlock: number;
  memberCount: number;
  allocations: Array<MemberAllocation & { proof: string[] }>;
}

// --- Merkle tree using ethers v5 crypto primitives ---

function hashLeaf(address: string, amount: ethers.BigNumber): string {
  // OZ v5 double-hash: keccak256(bytes.concat(keccak256(abi.encode(address, uint256))))
  // Uses abi.encode (32-byte padded), NOT encodePacked
  const inner = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(['address', 'uint256'], [address, amount])
  );
  return ethers.utils.keccak256(inner);
}

function hashPair(a: string, b: string): string {
  // Sort pair to ensure deterministic tree (OpenZeppelin convention)
  const [left, right] = a < b ? [a, b] : [b, a];
  return ethers.utils.solidityKeccak256(['bytes32', 'bytes32'], [left, right]);
}

function buildMerkleTree(leaves: string[]): string[][] {
  if (leaves.length === 0) return [[]];

  // Sort leaves for deterministic ordering
  const sorted = [...leaves].sort();
  const layers: string[][] = [sorted];

  let current = sorted;
  while (current.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < current.length; i += 2) {
      if (i + 1 < current.length) {
        next.push(hashPair(current[i], current[i + 1]));
      } else {
        // Odd leaf promoted as-is
        next.push(current[i]);
      }
    }
    layers.push(next);
    current = next;
  }

  return layers;
}

function getMerkleProof(layers: string[][], leaf: string): string[] {
  const proof: string[] = [];
  let index = layers[0].indexOf(leaf);

  if (index === -1) return [];

  for (let i = 0; i < layers.length - 1; i++) {
    const layer = layers[i];
    const isRight = index % 2 === 1;
    const siblingIndex = isRight ? index - 1 : index + 1;

    if (siblingIndex < layer.length) {
      proof.push(layer[siblingIndex]);
    }

    index = Math.floor(index / 2);
  }

  return proof;
}

// --- Subgraph query for members ---

const FETCH_MEMBERS_PT = `
  query FetchMembersPT($orgId: Bytes!) {
    organization(id: $orgId) {
      users(
        orderBy: participationTokenBalance,
        orderDirection: desc,
        first: 1000
      ) {
        address
        participationTokenBalance
        membershipStatus
        account {
          username
        }
      }
      participationToken {
        totalSupply
      }
    }
  }
`;

export const computeMerkleHandler = {
  builder: (yargs: Argv) => yargs
    .option('amount', { type: 'string', demandOption: true, describe: 'Total distribution amount (in token units, e.g. "40" for 40 BREAD)' })
    .option('token', { type: 'string', demandOption: true, describe: 'Payout token address' })
    .option('output', { type: 'string', default: 'merkle-distribution.json', describe: 'Output file for proofs' }),

  handler: async (argv: ArgumentsCamelCase<ComputeMerkleArgs>) => {
    const spin = output.spinner('Computing merkle tree...');
    spin.start();

    try {
      const modules = await resolveOrgModules(argv.org, argv.chain);
      const networkConfig = resolveNetworkConfig(argv.chain);
      const provider = new ethers.providers.JsonRpcProvider(networkConfig.resolvedRpc);

      // Get current block as checkpoint
      const checkpointBlock = await provider.getBlockNumber();

      // Fetch all members and PT balances
      spin.text = 'Fetching member PT balances...';
      const result = await query<any>(FETCH_MEMBERS_PT, { orgId: modules.orgId }, argv.chain);
      const org = result.organization;

      if (!org) {
        throw new Error('Organization not found');
      }

      const totalPTSupply = ethers.BigNumber.from(org.participationToken.totalSupply);
      if (totalPTSupply.isZero()) {
        throw new Error('No participation tokens in circulation');
      }

      // Filter to active members with PT > 0
      const activeMembers = org.users.filter((u: any) =>
        u.membershipStatus === 'Active' &&
        ethers.BigNumber.from(u.participationTokenBalance).gt(0)
      );

      if (activeMembers.length === 0) {
        throw new Error('No active members with PT balance');
      }

      // Parse distribution amount
      const totalAmount = ethers.utils.parseEther(argv.amount);

      // Calculate pro-rata allocations based on PT share
      spin.text = `Computing allocations for ${activeMembers.length} members...`;

      // Sum PT of eligible members (may differ from totalSupply if some are inactive)
      const eligiblePT = activeMembers.reduce(
        (sum: ethers.BigNumber, m: any) => sum.add(ethers.BigNumber.from(m.participationTokenBalance)),
        ethers.BigNumber.from(0)
      );

      const allocations: MemberAllocation[] = activeMembers.map((m: any) => {
        const ptBal = ethers.BigNumber.from(m.participationTokenBalance);
        // Pro-rata: allocation = totalAmount * memberPT / eligiblePT
        const allocation = totalAmount.mul(ptBal).div(eligiblePT);
        const sharePercent = ptBal.mul(10000).div(eligiblePT).toNumber() / 100;

        return {
          address: ethers.utils.getAddress(m.address),
          username: m.account?.username || null,
          ptBalance: ethers.utils.formatEther(ptBal),
          share: `${sharePercent.toFixed(2)}%`,
          allocation: allocation.toString(),
        };
      });

      // Handle rounding dust — give remainder to largest holder
      const allocatedTotal = allocations.reduce(
        (sum, a) => sum.add(ethers.BigNumber.from(a.allocation)),
        ethers.BigNumber.from(0)
      );
      const dust = totalAmount.sub(allocatedTotal);
      if (dust.gt(0)) {
        allocations[0].allocation = ethers.BigNumber.from(allocations[0].allocation).add(dust).toString();
      }

      // Build merkle tree
      spin.text = 'Building merkle tree...';

      const leaves = allocations.map(a =>
        hashLeaf(a.address, ethers.BigNumber.from(a.allocation))
      );

      const layers = buildMerkleTree(leaves);
      const merkleRoot = layers[layers.length - 1][0];

      // Generate proofs for each member
      const allocationsWithProofs = allocations.map((a, i) => ({
        ...a,
        proof: getMerkleProof(layers, leaves[i]),
      }));

      // Build output
      const merkleResult: MerkleResult = {
        merkleRoot,
        totalAmount: totalAmount.toString(),
        tokenAddress: argv.token,
        checkpointBlock,
        memberCount: allocations.length,
        allocations: allocationsWithProofs,
      };

      // Write to file
      const outPath = argv.output as string;
      fs.writeFileSync(outPath, JSON.stringify(merkleResult, null, 2) + '\n');

      spin.stop();

      if (output.isJsonMode()) {
        output.json(merkleResult);
      } else {
        console.log('');
        console.log('  Merkle Distribution Computed');
        console.log('  ─────────────────────────────');
        console.log(`  Root:        ${merkleRoot}`);
        console.log(`  Token:       ${argv.token}`);
        console.log(`  Total:       ${ethers.utils.formatEther(totalAmount)} tokens`);
        console.log(`  Checkpoint:  Block #${checkpointBlock}`);
        console.log(`  Members:     ${allocations.length}`);
        console.log('');
        console.log('  Allocations:');
        for (const a of allocationsWithProofs) {
          const label = a.username || a.address.slice(0, 10) + '...';
          console.log(`    ${label.padEnd(20)} ${a.share.padStart(8)}  →  ${ethers.utils.formatEther(a.allocation)} tokens`);
        }
        console.log('');
        console.log(`  Proofs written to: ${outPath}`);
        console.log('');
        console.log('  To create distribution:');
        console.log(`    pop treasury deposit --token ${argv.token} --amount ${argv.amount}`);
        console.log(`    # Then propose via governance with createDistribution(${argv.token}, ${totalAmount}, ${merkleRoot}, ${checkpointBlock})`);
        console.log('');
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
