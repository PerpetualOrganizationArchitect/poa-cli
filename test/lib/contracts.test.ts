import { describe, it, expect } from 'vitest';
import { ethers } from 'ethers';
import { loadAbi, createReadContract, createWriteContract } from '../../src/lib/contracts';

describe('loadAbi', () => {
  it('loads a real ABI file from src/abi/', () => {
    // ParticipationToken is one of the smaller stable ABIs always present
    const abi = loadAbi('ParticipationToken');
    expect(Array.isArray(abi)).toBe(true);
    expect(abi.length).toBeGreaterThan(0);
  });

  it('caches subsequent calls (returns reference-equal result)', () => {
    const a = loadAbi('ParticipationToken');
    const b = loadAbi('ParticipationToken');
    // Cache returns the same array reference
    expect(a).toBe(b);
  });

  it('throws a clear error for a missing ABI', () => {
    expect(() => loadAbi('DefinitelyDoesNotExist_xyzzy')).toThrow(/ABI file not found/);
  });
});

describe('createReadContract', () => {
  it('returns an ethers.Contract instance with the given address', () => {
    const provider = new ethers.providers.JsonRpcProvider('http://localhost:1');
    const addr = '0x1234567890abcdef1234567890abcdef12345678';
    const contract = createReadContract(addr, 'ParticipationToken', provider);
    expect(contract).toBeInstanceOf(ethers.Contract);
    expect(contract.address.toLowerCase()).toBe(addr.toLowerCase());
  });
});

describe('createWriteContract', () => {
  it('returns an ethers.Contract instance bound to the signer', () => {
    const provider = new ethers.providers.JsonRpcProvider('http://localhost:1');
    const wallet = ethers.Wallet.createRandom().connect(provider);
    const addr = '0x' + 'a'.repeat(40);
    const contract = createWriteContract(addr, 'ParticipationToken', wallet);
    expect(contract).toBeInstanceOf(ethers.Contract);
    expect(contract.address.toLowerCase()).toBe(addr);
    expect(contract.signer).toBe(wallet);
  });
});
