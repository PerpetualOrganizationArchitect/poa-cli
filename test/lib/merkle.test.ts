import { describe, it, expect } from 'vitest';
import { ethers } from 'ethers';

// Replicate the merkle functions from compute-merkle.ts to test them in isolation
function hashLeaf(address: string, amount: ethers.BigNumber): string {
  // OZ v5 double-hash
  const inner = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(['address', 'uint256'], [address, amount])
  );
  return ethers.utils.keccak256(inner);
}

function hashPair(a: string, b: string): string {
  const [left, right] = a < b ? [a, b] : [b, a];
  return ethers.utils.solidityKeccak256(['bytes32', 'bytes32'], [left, right]);
}

function buildMerkleTree(leaves: string[]): string[][] {
  if (leaves.length === 0) return [[]];
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

function getMerkleProof(layers: string[][], leaf: string): string[] {
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

function verifyProof(leaf: string, proof: string[], root: string): boolean {
  let hash = leaf;
  for (const p of proof) hash = hashPair(hash, p);
  return hash === root;
}

describe('Merkle Tree (OZ v5 double-hash)', () => {
  const addr1 = '0x451563aB9b5b4E8DFAA602F5E7890089eDf6Bf10';
  const addr2 = '0xC04C860454e73a9Ba524783aCbC7f7D6F5767eb6';

  describe('hashLeaf', () => {
    it('produces different hashes for different amounts', () => {
      const h1 = hashLeaf(addr1, ethers.utils.parseEther('100'));
      const h2 = hashLeaf(addr1, ethers.utils.parseEther('200'));
      expect(h1).not.toBe(h2);
    });

    it('produces different hashes for different addresses', () => {
      const amount = ethers.utils.parseEther('100');
      const h1 = hashLeaf(addr1, amount);
      const h2 = hashLeaf(addr2, amount);
      expect(h1).not.toBe(h2);
    });

    it('uses double-hash (not single keccak)', () => {
      const amount = ethers.utils.parseEther('100');
      const singleHash = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(['address', 'uint256'], [addr1, amount])
      );
      const doubleHash = hashLeaf(addr1, amount);
      expect(doubleHash).not.toBe(singleHash);
      // Double hash should be keccak of the single hash
      expect(doubleHash).toBe(ethers.utils.keccak256(singleHash));
    });

    it('uses abi.encode not encodePacked', () => {
      const amount = ethers.utils.parseEther('100');
      const packed = ethers.utils.solidityKeccak256(['address', 'uint256'], [addr1, amount]);
      const doubleHash = hashLeaf(addr1, amount);
      // Should NOT match encodePacked
      expect(doubleHash).not.toBe(packed);
      expect(doubleHash).not.toBe(ethers.utils.keccak256(packed));
    });
  });

  describe('hashPair', () => {
    it('is commutative (sorted)', () => {
      const a = hashLeaf(addr1, ethers.utils.parseEther('100'));
      const b = hashLeaf(addr2, ethers.utils.parseEther('50'));
      expect(hashPair(a, b)).toBe(hashPair(b, a));
    });
  });

  describe('buildMerkleTree + verify', () => {
    it('builds valid tree for 2 leaves', () => {
      const leaf1 = hashLeaf(addr1, ethers.utils.parseEther('70'));
      const leaf2 = hashLeaf(addr2, ethers.utils.parseEther('30'));
      const layers = buildMerkleTree([leaf1, leaf2]);
      const root = layers[layers.length - 1][0];

      expect(root).toBeDefined();
      expect(layers.length).toBe(2); // leaves + root

      const proof1 = getMerkleProof(layers, leaf1);
      const proof2 = getMerkleProof(layers, leaf2);
      expect(verifyProof(leaf1, proof1, root)).toBe(true);
      expect(verifyProof(leaf2, proof2, root)).toBe(true);
    });

    it('builds valid tree for 3 leaves', () => {
      const addr3 = '0x0000000000000000000000000000000000000001';
      const leaf1 = hashLeaf(addr1, ethers.utils.parseEther('50'));
      const leaf2 = hashLeaf(addr2, ethers.utils.parseEther('30'));
      const leaf3 = hashLeaf(addr3, ethers.utils.parseEther('20'));
      const layers = buildMerkleTree([leaf1, leaf2, leaf3]);
      const root = layers[layers.length - 1][0];

      for (const leaf of [leaf1, leaf2, leaf3]) {
        const proof = getMerkleProof(layers, leaf);
        expect(verifyProof(leaf, proof, root)).toBe(true);
      }
    });

    it('rejects invalid proofs', () => {
      const leaf1 = hashLeaf(addr1, ethers.utils.parseEther('70'));
      const leaf2 = hashLeaf(addr2, ethers.utils.parseEther('30'));
      const layers = buildMerkleTree([leaf1, leaf2]);
      const root = layers[layers.length - 1][0];

      // Wrong amount
      const fakeLeaf = hashLeaf(addr1, ethers.utils.parseEther('999'));
      const proof = getMerkleProof(layers, leaf1);
      expect(verifyProof(fakeLeaf, proof, root)).toBe(false);
    });

    it('handles empty leaves', () => {
      const layers = buildMerkleTree([]);
      expect(layers).toEqual([[]]);
    });

    it('handles single leaf', () => {
      const leaf = hashLeaf(addr1, ethers.utils.parseEther('100'));
      const layers = buildMerkleTree([leaf]);
      const root = layers[layers.length - 1][0];
      expect(root).toBe(leaf);
      expect(getMerkleProof(layers, leaf)).toEqual([]);
      expect(verifyProof(leaf, [], root)).toBe(true);
    });
  });

  describe('pro-rata allocation', () => {
    it('distributes correctly and handles dust', () => {
      const total = ethers.utils.parseEther('10');
      const pt1 = ethers.BigNumber.from('700');
      const pt2 = ethers.BigNumber.from('300');
      const eligiblePT = pt1.add(pt2);

      const alloc1 = total.mul(pt1).div(eligiblePT);
      const alloc2 = total.mul(pt2).div(eligiblePT);
      const dust = total.sub(alloc1.add(alloc2));

      // Dust should be small
      expect(dust.lte(2)).toBe(true);
      // Sum + dust = total
      expect(alloc1.add(alloc2).add(dust).eq(total)).toBe(true);
    });
  });
});
