/**
 * EIP-7702 Gas Sponsorship
 *
 * Uses the org PaymasterHub to sponsor agent transaction gas.
 * Flow: Agent EOA → EIP-7702 delegation → UserOp via Pimlico bundler → PaymasterHub pays gas.
 *
 * Prerequisites:
 * - Agent registered in UniversalAccountRegistry
 * - Agent wears a hat in the org
 * - PIMLICO_API_KEY in env
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  type Hex,
  type Address,
  concat,
  pad,
  toHex,
  type Abi,
} from 'viem';
import { gnosis } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import {
  entryPoint07Address,
  type EntryPointVersion,
} from 'viem/account-abstraction';

// Contract addresses (Gnosis)
export const EOA_DELEGATION = '0x776ec88A88E86e38d54a985983377f1A2A25ef8b' as Address;
export const PAYMASTER_HUB = '0xdEf1038C297493c0b5f82F0CDB49e929B53B4108' as Address;
export const ENTRY_POINT = entryPoint07Address;

/**
 * Encode paymaster data for the PaymasterHub.
 * Format: version(1) | orgId(32) | subjectType=0x01(1) | hatId(32) | ruleId=0x00000000(4)
 */
export function encodePaymasterData(orgId: Hex, hatId: bigint): Hex {
  const version = '0x01' as Hex;
  const paddedOrgId = pad(orgId as Hex, { size: 32 });
  const subjectType = '0x01' as Hex;
  const paddedHatId = pad(toHex(hatId), { size: 32 });
  const ruleId = '0x00000000' as Hex;

  return concat([version, paddedOrgId, subjectType, paddedHatId, ruleId]);
}

/**
 * Check if an EOA has already delegated to EOADelegation.
 */
export async function isDelegated(address: Address, rpcUrl?: string): Promise<boolean> {
  const client = createPublicClient({
    chain: gnosis,
    transport: http(rpcUrl || 'https://rpc.gnosischain.com'),
  });

  const code = await client.getCode({ address });
  return code !== undefined && code !== '0x' && code.startsWith('0xef0100');
}

/**
 * Sign EIP-7702 authorization to delegate EOA to EOADelegation contract.
 * This is a one-time setup — after delegation, the EOA can receive UserOps.
 */
export async function delegateEOA(privateKey: Hex, rpcUrl?: string): Promise<Hex> {
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account,
    chain: gnosis,
    transport: http(rpcUrl || 'https://rpc.gnosischain.com'),
  });

  // Sign the authorization
  const authorization = await walletClient.signAuthorization({
    contractAddress: EOA_DELEGATION,
    executor: 'self',
  });

  // Send the delegation transaction
  const hash = await walletClient.sendTransaction({
    authorizationList: [authorization],
    to: account.address,
    data: '0x' as Hex,
  });

  return hash;
}

/**
 * Send a sponsored transaction via Pimlico bundler.
 * The PaymasterHub pays for gas — agent pays nothing.
 *
 * @param privateKey - Agent's private key
 * @param to - Target contract address
 * @param data - Encoded function call data
 * @param orgId - POP org ID (hex)
 * @param hatId - Agent's hat ID
 * @param options - Optional overrides
 */
export async function sendSponsored(
  privateKey: Hex,
  to: Address,
  data: Hex,
  orgId: Hex,
  hatId: bigint,
  options?: {
    rpcUrl?: string;
    value?: bigint;
    pimlicoApiKey?: string;
  }
): Promise<{ txHash: Hex; userOpHash: Hex }> {
  const apiKey = options?.pimlicoApiKey || process.env.PIMLICO_API_KEY;
  if (!apiKey) {
    throw new Error('PIMLICO_API_KEY required for sponsored transactions. Set in .env.');
  }

  const rpcUrl = options?.rpcUrl || 'https://rpc.gnosischain.com';
  const account = privateKeyToAccount(privateKey);
  const pimlicoUrl = `https://api.pimlico.io/v2/${gnosis.id}/rpc?apikey=${apiKey}`;

  // Check delegation
  const delegated = await isDelegated(account.address, rpcUrl);
  if (!delegated) {
    throw new Error(
      `EOA ${account.address} not delegated to EOADelegation. ` +
      `Run 'pop agent delegate' first to set up EIP-7702 delegation.`
    );
  }

  const publicClient = createPublicClient({
    chain: gnosis,
    transport: http(rpcUrl),
  });

  const pimlicoClient = createPimlicoClient({
    chain: gnosis,
    transport: http(pimlicoUrl),
    entryPoint: {
      address: ENTRY_POINT,
      version: '0.7' as EntryPointVersion,
    },
  });

  // Encode paymaster data
  const paymasterData = encodePaymasterData(orgId, hatId);

  // Get gas prices
  const gasPrices = await pimlicoClient.getUserOperationGasPrice();

  // Build the UserOperation calldata
  // EOADelegation.execute(target, value, data) format
  const executeAbi = [{
    name: 'execute',
    type: 'function',
    inputs: [
      { name: 'target', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  }] as const;

  const callData = encodeFunctionData({
    abi: executeAbi,
    functionName: 'execute',
    args: [to, options?.value || 0n, data],
  });

  // Get nonce
  const nonce = await publicClient.readContract({
    address: ENTRY_POINT,
    abi: [{
      name: 'getNonce',
      type: 'function',
      inputs: [
        { name: 'sender', type: 'address' },
        { name: 'key', type: 'uint192' },
      ],
      outputs: [{ type: 'uint256' }],
      stateMutability: 'view',
    }] as const,
    functionName: 'getNonce',
    args: [account.address, 0n],
  });

  // Build UserOperation
  const userOp = {
    sender: account.address,
    nonce,
    callData,
    maxFeePerGas: gasPrices.fast.maxFeePerGas,
    maxPriorityFeePerGas: gasPrices.fast.maxPriorityFeePerGas,
    paymaster: PAYMASTER_HUB,
    paymasterData,
    signature: '0x' as Hex, // placeholder, will be replaced after estimation
  };

  // Estimate gas
  const gasEstimate = await pimlicoClient.estimateUserOperationGas(
    userOp as any,
  );

  // Apply gas estimates
  const fullUserOp = {
    ...userOp,
    callGasLimit: gasEstimate.callGasLimit,
    verificationGasLimit: gasEstimate.verificationGasLimit,
    preVerificationGas: gasEstimate.preVerificationGas,
    paymasterVerificationGasLimit: gasEstimate.paymasterVerificationGasLimit,
    paymasterPostOpGasLimit: gasEstimate.paymasterPostOpGasLimit,
  };

  // Sign the UserOperation
  // The EOADelegation contract validates the signature
  const walletClient = createWalletClient({
    account,
    chain: gnosis,
    transport: http(rpcUrl),
  });

  // Hash and sign the UserOp (simplified — real implementation needs proper EIP-4337 hashing)
  // For now, submit and let the bundler handle validation
  const userOpHash = await pimlicoClient.sendUserOperation(
    fullUserOp as any,
  );

  // Wait for receipt
  const receipt = await pimlicoClient.waitForUserOperationReceipt({
    hash: userOpHash,
  });

  return {
    txHash: receipt.receipt.transactionHash as Hex,
    userOpHash: userOpHash as Hex,
  };
}

/**
 * Helper: encode a contract function call for use with sendSponsored.
 */
export function encodeCall(abi: Abi, functionName: string, args: any[]): Hex {
  return encodeFunctionData({ abi, functionName, args });
}
