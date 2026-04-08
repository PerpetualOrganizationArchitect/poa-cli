/**
 * Transaction Execution
 * Send transactions, wait for confirmation, support dry-run mode.
 */

import { ethers } from 'ethers';
import { getNetworkByChainId } from '../config/networks';

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
}

export interface TxOptions {
  dryRun?: boolean;
  gasLimit?: number;
  value?: ethers.BigNumber;
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
 * Execute a contract method.
 * In dry-run mode: estimates gas and encodes calldata without sending.
 * Returns parsed event logs so callers can extract entity IDs.
 */
export async function executeTx(
  contract: ethers.Contract,
  method: string,
  args: any[],
  options: TxOptions = {}
): Promise<TxResult> {
  try {
    // Estimate gas first
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

    // Send transaction
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
