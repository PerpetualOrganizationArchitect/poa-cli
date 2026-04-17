import type { Argv, ArgumentsCamelCase } from 'yargs';
import net from 'net';
import { ethers } from 'ethers';
import { resolveNetworkConfig } from '../../config/networks';
import { query } from '../../lib/subgraph';
import { FETCH_INFRASTRUCTURE_ADDRESSES } from '../../queries/infrastructure';
import { getRunningDaemonPid, getDaemonSockPath } from '../../lib/brain-daemon';
import * as output from '../../lib/output';

export const validateHandler = {
  builder: (yargs: Argv) => yargs,

  handler: async (argv: ArgumentsCamelCase<any>) => {
    const results: Array<{ check: string; status: string; detail?: string }> = [];

    // Check chain config
    let chainId: number | undefined;
    try {
      chainId = argv.chain as number || (process.env.POP_DEFAULT_CHAIN ? parseInt(process.env.POP_DEFAULT_CHAIN, 10) : undefined);
      if (!chainId) {
        results.push({ check: 'Chain', status: 'SKIP', detail: 'No chain configured' });
      } else {
        resolveNetworkConfig(chainId);
        results.push({ check: 'Chain', status: 'OK', detail: `Chain ID ${chainId}` });
      }
    } catch (e: any) {
      results.push({ check: 'Chain', status: 'FAIL', detail: e.message });
    }

    // Check RPC
    if (chainId) {
      try {
        const config = resolveNetworkConfig(chainId);
        const provider = new ethers.providers.JsonRpcProvider(config.resolvedRpc, chainId);
        const blockNumber = await provider.getBlockNumber();
        results.push({ check: 'RPC', status: 'OK', detail: `Block #${blockNumber}` });
      } catch (e: any) {
        results.push({ check: 'RPC', status: 'FAIL', detail: e.message });
      }
    }

    // Check subgraph
    if (chainId) {
      try {
        const infra = await query<any>(FETCH_INFRASTRUCTURE_ADDRESSES, {}, chainId);
        const orgCount = infra.orgRegistryContracts?.[0]?.totalOrgs || '?';
        results.push({ check: 'Subgraph', status: 'OK', detail: `${orgCount} orgs indexed` });
      } catch (e: any) {
        results.push({ check: 'Subgraph', status: 'FAIL', detail: e.message.substring(0, 100) });
      }
    }

    // Check private key
    const key = (argv.privateKey as string) || process.env.POP_PRIVATE_KEY;
    let walletAddress: string | undefined;
    if (key) {
      try {
        const wallet = new ethers.Wallet(key);
        walletAddress = wallet.address;
        results.push({ check: 'Wallet', status: 'OK', detail: wallet.address });
      } catch {
        results.push({ check: 'Wallet', status: 'FAIL', detail: 'Invalid private key format' });
      }
    } else {
      results.push({ check: 'Wallet', status: 'SKIP', detail: 'No private key configured' });
    }

    // Check wallet balance (gas)
    if (walletAddress && chainId) {
      try {
        const config = resolveNetworkConfig(chainId);
        const provider = new ethers.providers.JsonRpcProvider(config.resolvedRpc, chainId);
        const balance = await provider.getBalance(walletAddress);
        const balanceFormatted = ethers.utils.formatEther(balance);
        const symbol = config.nativeCurrency.symbol;
        const LOW_GAS_THRESHOLD = ethers.utils.parseEther('0.01');

        if (balance.lt(LOW_GAS_THRESHOLD)) {
          results.push({ check: 'Gas', status: 'WARN', detail: `${balanceFormatted} ${symbol} — low, fund wallet for reliable transacting` });
        } else {
          results.push({ check: 'Gas', status: 'OK', detail: `${balanceFormatted} ${symbol}` });
        }
      } catch {
        results.push({ check: 'Gas', status: 'SKIP', detail: 'Could not query balance' });
      }
    }

    // Check brain daemon (HB#321 vigil, Step 2.8 Q2 — complements
    // heartbeat-skill Step 0.5 by surfacing daemon state in the
    // top-level health check command too)
    try {
      const pid = getRunningDaemonPid();
      if (pid === null) {
        results.push({
          check: 'Brain daemon',
          status: 'WARN',
          detail: "not running — start with 'pop brain daemon start' (cross-agent gossip disabled)",
        });
      } else {
        // Try to query status via IPC for connection count.
        const sockPath = getDaemonSockPath();
        const status: any = await new Promise((resolve) => {
          const socket = net.createConnection(sockPath);
          let buf = '';
          const timer = setTimeout(() => { socket.destroy(); resolve(null); }, 2000);
          socket.on('connect', () => {
            socket.write(JSON.stringify({ id: '1', method: 'status' }) + '\n');
          });
          socket.on('data', (chunk) => {
            buf += chunk.toString('utf8');
            const nl = buf.indexOf('\n');
            if (nl >= 0) {
              clearTimeout(timer);
              try { socket.end(); resolve(JSON.parse(buf.slice(0, nl)).result ?? null); }
              catch { resolve(null); }
            }
          });
          socket.on('error', () => { clearTimeout(timer); resolve(null); });
        });
        if (status && typeof status.connections === 'number') {
          if (status.connections === 0) {
            results.push({
              check: 'Brain daemon',
              status: 'WARN',
              detail: `running (pid ${pid}) but isolated — 0 peers. Fix POP_BRAIN_PEERS and restart.`,
            });
          } else {
            results.push({
              check: 'Brain daemon',
              status: 'OK',
              detail: `running (pid ${pid}, ${status.connections} peer${status.connections === 1 ? '' : 's'})`,
            });
          }
        } else {
          results.push({
            check: 'Brain daemon',
            status: 'WARN',
            detail: `pid ${pid} alive but IPC did not respond`,
          });
        }
      }
    } catch (e: any) {
      results.push({ check: 'Brain daemon', status: 'SKIP', detail: e.message?.slice(0, 80) ?? 'probe failed' });
    }

    // Output
    if (output.isJsonMode()) {
      output.json(results);
    } else {
      console.log('');
      for (const r of results) {
        const icon = r.status === 'OK' ? '\x1b[32m✓\x1b[0m' : r.status === 'FAIL' ? '\x1b[31m✗\x1b[0m' : r.status === 'WARN' ? '\x1b[33m!\x1b[0m' : '\x1b[33m-\x1b[0m';
        console.log(`  ${icon} ${r.check.padEnd(10)} ${r.detail || ''}`);
      }
      console.log('');

      const failed = results.filter(r => r.status === 'FAIL');
      if (failed.length > 0) {
        process.exit(1);
      }
    }
  },
};
