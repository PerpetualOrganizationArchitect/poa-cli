import type { Argv, ArgumentsCamelCase } from 'yargs';
import * as output from '../../lib/output';

const SAFE_API_GNOSIS = 'https://safe-transaction-gnosis-chain.safe.global/api/v1';
const SAFE_API_ARBITRUM = 'https://safe-transaction-arbitrum.safe.global/api/v1';
const SAFE_API_ETHEREUM = 'https://safe-transaction-mainnet.safe.global/api/v1';

interface AuditSafeArgs {
  org: string;
  address: string;
  chain?: number;
  pin?: boolean;
  rpc?: string;
}

function getApiBase(chainId: number): string {
  if (chainId === 100) return SAFE_API_GNOSIS;
  if (chainId === 42161) return SAFE_API_ARBITRUM;
  if (chainId === 1) return SAFE_API_ETHEREUM;
  return SAFE_API_GNOSIS;
}

async function safeFetch(url: string): Promise<any> {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`Safe API ${response.status}: ${response.statusText}`);
  return response.json();
}

export const auditSafeHandler = {
  builder: (yargs: Argv) => yargs
    .option('address', { type: 'string', demandOption: true, describe: 'Safe multisig address' })
    .option('pin', { type: 'boolean', default: false, describe: 'Pin report to IPFS' }),

  handler: async (argv: ArgumentsCamelCase<AuditSafeArgs>) => {
    const spin = output.spinner(`Auditing Safe: ${argv.address}...`);
    spin.start();

    try {
      const chainId = argv.chain || 100;
      const apiBase = getApiBase(chainId);
      const address = argv.address as string;

      // Fetch Safe info
      spin.text = 'Fetching Safe info...';
      const safeInfo = await safeFetch(`${apiBase}/safes/${address}/`);

      // Fetch balances
      spin.text = 'Fetching balances...';
      let balances: any[] = [];
      try {
        const balData = await safeFetch(`${apiBase}/safes/${address}/balances/usd/`);
        balances = Array.isArray(balData) ? balData : [];
      } catch {
        // Some chains don't support USD balances
        try {
          const balData = await safeFetch(`${apiBase}/safes/${address}/balances/`);
          balances = Array.isArray(balData) ? balData : [];
        } catch { /* no balance data */ }
      }

      // Fetch recent transactions
      spin.text = 'Fetching transactions...';
      let transactions: any[] = [];
      try {
        const txData = await safeFetch(`${apiBase}/safes/${address}/multisig-transactions/?limit=50`);
        transactions = txData.results || [];
      } catch { /* no tx data */ }

      // Analysis
      const owners = safeInfo.owners || [];
      const threshold = safeInfo.threshold || 0;
      const nonce = safeInfo.nonce || 0;

      // Balance summary
      const tokenBalances = balances
        .filter((b: any) => {
          const value = parseFloat(b.fiatBalance || b.balance || '0');
          return value > 0;
        })
        .map((b: any) => ({
          token: b.token?.symbol || b.tokenAddress || 'Native',
          balance: b.balance ? (parseFloat(b.balance) / Math.pow(10, b.token?.decimals || 18)).toFixed(4) : '0',
          usdValue: b.fiatBalance ? `$${parseFloat(b.fiatBalance).toFixed(2)}` : undefined,
        }))
        .slice(0, 10);

      const totalUSD = balances.reduce((sum: number, b: any) => sum + parseFloat(b.fiatBalance || '0'), 0);

      // Transaction analysis
      const executedTxs = transactions.filter((t: any) => t.isExecuted);
      const pendingTxs = transactions.filter((t: any) => !t.isExecuted);

      // Unique signers across transactions
      const signerSet = new Set<string>();
      for (const tx of executedTxs) {
        if (tx.confirmations) {
          for (const conf of tx.confirmations) {
            signerSet.add(conf.owner?.toLowerCase());
          }
        }
      }

      // Risks
      const risks: string[] = [];
      if (threshold === 1) risks.push(`1-of-${owners.length} threshold — single signer can execute any transaction`);
      if (threshold > 0 && threshold < Math.ceil(owners.length / 2)) {
        risks.push(`Low threshold (${threshold}/${owners.length}) — less than majority required`);
      }
      if (owners.length === 1) risks.push('Single owner — no separation of control');
      if (executedTxs.length === 0 && nonce === 0) risks.push('No transaction history — newly created or unused');
      if (pendingTxs.length > 5) risks.push(`${pendingTxs.length} pending transactions — possible governance stall`);
      if (signerSet.size > 0 && signerSet.size < owners.length / 2) {
        risks.push(`Only ${signerSet.size}/${owners.length} signers active — concentration of execution power`);
      }

      const recommendations: string[] = [];
      if (threshold === 1) recommendations.push('Increase threshold to at least 2-of-N for security');
      if (owners.length < 3) recommendations.push('Add more signers to reduce single-point-of-failure risk');
      if (totalUSD > 100000 && threshold < 3) recommendations.push('High-value treasury should use 3+ threshold');

      const report: any = {
        safe: address,
        chain: chainId === 100 ? 'Gnosis' : chainId === 42161 ? 'Arbitrum' : chainId === 1 ? 'Ethereum' : `Chain ${chainId}`,
        auditor: 'Argus',
        date: new Date().toISOString().split('T')[0],
        summary: {
          owners: owners.length,
          threshold,
          nonce,
          totalTransactions: nonce,
          recentExecuted: executedTxs.length,
          pendingTransactions: pendingTxs.length,
          activeSigners: signerSet.size,
          totalUSD: totalUSD > 0 ? `$${totalUSD.toFixed(2)}` : 'Unknown',
        },
        tokenBalances: tokenBalances.length > 0 ? tokenBalances : undefined,
        owners: owners.map((o: string) => o.slice(0, 8) + '...' + o.slice(-4)),
        risks,
        recommendations,
      };

      if (argv.pin) {
        const { pinJson } = require('../../lib/ipfs');
        const cid = await pinJson(JSON.stringify(report));
        report.ipfsCid = cid;
      }

      spin.stop();

      if (argv.json) {
        output.json(report);
      } else {
        output.success(`Safe Audit: ${address.slice(0, 8)}...${address.slice(-4)}`, {
          chain: report.chain,
          threshold: `${threshold}/${owners.length}`,
          transactions: nonce,
          activeSigners: `${signerSet.size}/${owners.length}`,
          totalUSD: report.summary.totalUSD,
          risks: risks.join('; ') || 'None identified',
        });
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
