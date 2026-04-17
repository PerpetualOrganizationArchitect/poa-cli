/**
 * Transaction Execution
 * Send transactions, wait for confirmation, support dry-run mode.
 * Automatically routes through EIP-7702 gas sponsorship when available.
 */

import { ethers } from 'ethers';
import { getNetworkByChainId } from '../config/networks';
import { isDelegated, sendSponsored } from './sponsored';
import type { Hex, Address } from 'viem';

export type ErrorCode =
  | 'TX_REVERTED'
  | 'INSUFFICIENT_FUNDS'
  | 'NETWORK_ERROR'
  | 'USER_REJECTED'
  | 'GAS_ESTIMATION_FAILED'
  | 'UNKNOWN_ERROR';

export interface TxResult {
  success: boolean;
  txHash?: string;
  blockNumber?: number;
  gasUsed?: string;
  explorerUrl?: string;
  logs?: ethers.utils.LogDescription[];
  error?: string;
  errorCode?: ErrorCode;
  sponsored?: boolean;
}

export interface SponsoredConfig {
  privateKey: Hex;
  orgId: Hex;
  hatId: bigint;
}

export interface TxOptions {
  dryRun?: boolean;
  gasLimit?: number;
  value?: ethers.BigNumber;
  sponsored?: SponsoredConfig;
}

/**
 * Resolve sponsored config from environment variables.
 * Returns undefined if required env vars are missing.
 */
export function resolveSponsoredConfig(): SponsoredConfig | undefined {
  const privateKey = process.env.POP_PRIVATE_KEY;
  const orgId = process.env.POP_ORG_ID;
  const hatId = process.env.POP_HAT_ID;
  const pimlicoKey = process.env.PIMLICO_API_KEY;

  if (!privateKey || !orgId || !hatId || !pimlicoKey) {
    return undefined;
  }

  return {
    privateKey: (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as Hex,
    orgId: orgId as Hex,
    hatId: BigInt(hatId),
  };
}

function buildExplorerUrl(txHash: string, chainId: number): string | undefined {
  const network = getNetworkByChainId(chainId);
  if (!network?.blockExplorer) return undefined;
  return `${network.blockExplorer}/tx/${txHash}`;
}

function parseEventLogs(
  receipt: ethers.providers.TransactionReceipt,
  contractInterface: ethers.utils.Interface
): ethers.utils.LogDescription[] {
  const parsed: ethers.utils.LogDescription[] = [];
  for (const log of receipt.logs) {
    try {
      parsed.push(contractInterface.parseLog(log));
    } catch {
      // Log from a different contract — skip
    }
  }
  return parsed;
}

function classifyError(error: any): { message: string; code: ErrorCode } {
  const msg = error.message || 'Transaction failed';

  if (error.code === 'INSUFFICIENT_FUNDS' || msg.includes('insufficient funds')) {
    return { message: 'Insufficient funds for gas + value', code: 'INSUFFICIENT_FUNDS' };
  }
  if (error.code === 'ACTION_REJECTED' || msg.includes('user rejected')) {
    return { message: 'Transaction rejected by user', code: 'USER_REJECTED' };
  }
  if (error.code === 'UNPREDICTABLE_GAS_LIMIT' || msg.includes('cannot estimate gas')) {
    const reason = error.reason || error.error?.reason || error.error?.message || msg;
    return { message: `Transaction would revert: ${reason}`, code: 'GAS_ESTIMATION_FAILED' };
  }
  if (error.code === 'NETWORK_ERROR' || error.code === 'SERVER_ERROR' || msg.includes('ECONNREFUSED')) {
    return { message: `Network error: ${msg}`, code: 'NETWORK_ERROR' };
  }
  if (error.reason) {
    return { message: `Reverted: ${error.reason}`, code: 'TX_REVERTED' };
  }
  if (error.error?.message) {
    return { message: error.error.message, code: 'TX_REVERTED' };
  }
  return { message: msg, code: 'UNKNOWN_ERROR' };
}

/**
 * Try to send a transaction via EIP-7702 gas sponsorship.
 * Returns null if sponsorship is not available or fails (caller should fall back to direct tx).
 */
async function trySponsoredTx(
  contract: ethers.Contract,
  method: string,
  args: any[],
  config: SponsoredConfig,
  options: TxOptions
): Promise<TxResult | null> {
  try {
    const signerAddress = await contract.signer.getAddress();

    // Check if EOA is delegated
    const delegated = await isDelegated(signerAddress as Address);
    if (!delegated) {
      return null;
    }

    // Encode the calldata
    const calldata = contract.interface.encodeFunctionData(method, args) as Hex;
    const to = contract.address as Address;

    const result = await sendSponsored(
      config.privateKey,
      to,
      calldata,
      config.orgId,
      config.hatId,
      {
        value: options.value ? BigInt(options.value.toString()) : undefined,
      }
    );

    const chainId = await contract.provider.getNetwork().then(n => n.chainId);

    // Fetch the receipt to get logs and gas used
    const receipt = await contract.provider.getTransactionReceipt(result.txHash);
    const logs = receipt ? parseEventLogs(receipt, contract.interface) : [];

    // Check outer tx status (bundler tx revert — rare but possible)
    if (receipt && receipt.status === 0) {
      return {
        success: false,
        txHash: result.txHash,
        error: 'Sponsored transaction reverted on-chain (bundler tx failed).',
        errorCode: 'TX_REVERTED' as ErrorCode,
        sponsored: true,
      };
    }

    // ERC-4337 critical check: the outer bundler tx ALWAYS has status=1,
    // even when the inner UserOp call reverts. The actual success/failure
    // of the inner call is in the UserOperationEvent log emitted by the
    // EntryPoint contract. We must check this to detect silent failures.
    //
    // UserOperationEvent signature:
    //   event UserOperationEvent(
    //     bytes32 indexed userOpHash, address indexed sender,
    //     address indexed paymaster,
    //     uint256 nonce, bool success, uint256 actualGasCost, uint256 actualGasUsed
    //   )
    // Topic 0: 0x49628fd1471006c1482da88028e9ce4dbb080b815c9b0344d39e5a8e6ec1419f
    // Data layout: nonce (32 bytes) | success (32 bytes) | actualGasCost | actualGasUsed
    const USER_OP_EVENT_TOPIC = '0x49628fd1471006c1482da88028e9ce4dbb080b815c9b0344d39e5a8e6ec1419f';
    if (receipt) {
      const userOpLog = receipt.logs.find(
        (log) => log.topics[0] === USER_OP_EVENT_TOPIC
      );
      if (userOpLog) {
        // success is the second 32-byte word in data (offset 66..130 in hex string)
        const successWord = userOpLog.data.slice(66, 130);
        const innerSuccess = parseInt(successWord, 16) !== 0;
        if (!innerSuccess) {
          // Check for UserOperationRevertReason event for more detail
          const REVERT_REASON_TOPIC = '0x1c4fada7374c0a9ee8841fc38afe82932dc0f8e69012e927f061a8bae611a201';
          const revertLog = receipt.logs.find(
            (log) => log.topics[0] === REVERT_REASON_TOPIC
          );
          const revertDetail = revertLog
            ? ` Revert data available in tx ${result.txHash}`
            : '';
          return {
            success: false,
            txHash: result.txHash,
            explorerUrl: buildExplorerUrl(result.txHash, chainId),
            error: `Sponsored UserOp inner call reverted (tx succeeded but execution failed).${revertDetail}`,
            errorCode: 'TX_REVERTED' as ErrorCode,
            sponsored: true,
          };
        }
      }
    }

    return {
      success: true,
      txHash: result.txHash,
      blockNumber: receipt?.blockNumber,
      gasUsed: receipt?.gasUsed?.toString(),
      explorerUrl: buildExplorerUrl(result.txHash, chainId),
      logs,
      sponsored: true,
    };
  } catch {
    // Sponsorship failed — fall back to direct tx
    return null;
  }
}

/**
 * Execute a contract method.
 * In dry-run mode: estimates gas and encodes calldata without sending.
 * When sponsored config is provided and the EOA is delegated, routes through
 * the PaymasterHub for gas sponsorship. Falls back to direct EOA tx if
 * sponsorship is unavailable or fails.
 * Returns parsed event logs so callers can extract entity IDs.
 */
export async function executeTx(
  contract: ethers.Contract,
  method: string,
  args: any[],
  options: TxOptions = {}
): Promise<TxResult> {
  try {
    // Estimate gas first (also validates the tx would succeed)
    const gasEstimate = await contract.estimateGas[method](...args, {
      value: options.value,
    });

    if (options.dryRun) {
      const calldata = contract.interface.encodeFunctionData(method, args);
      return {
        success: true,
        gasUsed: gasEstimate.toString(),
        txHash: `dry-run:${calldata.slice(0, 20)}...`,
      };
    }

    // Try sponsored tx: use explicit config or auto-resolve from env
    const sponsoredConfig = options.sponsored || resolveSponsoredConfig();
    if (sponsoredConfig) {
      const sponsoredResult = await trySponsoredTx(contract, method, args, sponsoredConfig, options);
      if (sponsoredResult) {
        return sponsoredResult;
      }
      // Fall through to direct tx
    }

    // Send transaction (direct EOA)
    const tx = await contract[method](...args, {
      gasLimit: options.gasLimit || gasEstimate.mul(120).div(100),
      value: options.value,
    });

    // Wait for confirmation
    const receipt = await tx.wait(1);
    const chainId = await contract.provider.getNetwork().then(n => n.chainId);

    return {
      success: true,
      txHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      explorerUrl: buildExplorerUrl(receipt.transactionHash, chainId),
      logs: parseEventLogs(receipt, contract.interface),
    };
  } catch (error: any) {
    const classified = classifyError(error);
    return {
      success: false,
      error: classified.message,
      errorCode: classified.code,
    };
  }
}
