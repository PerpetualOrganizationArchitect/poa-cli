/**
 * pop org audit-vetoken — on-chain veToken top-holder probe.
 *
 * Task #383 (HB#442). Closes the methodology gap surfaced in HB#441 when
 * reading argus_prime's Curve DAO audit (task #380, docs/audits/curve-dao.md):
 *
 * The Capture Cluster v1.2 identifies that our Snapshot-based top-voter-share
 * numbers for veToken protocols (Curve, Balancer, Frax, Convex, Beethoven X,
 * Kwenta, likely Prisma / 1inch) are measuring off-chain signaling votes, NOT
 * the binding on-chain veCRV-weighted decisions. The real voter population
 * lives in the VotingEscrow contract: holders hold time-locked positions
 * whose balanceOf() returns a linearly-decaying current voting power. This
 * command reads those balances directly.
 *
 * MVP scope:
 *   - Takes a VotingEscrow address + a list of candidate holder addresses
 *   - Reads balanceOf(holder) for each + totalSupply() for the denominator
 *   - Reports top-N ranked by current veBalance + share-of-supply percentages
 *   - --json output mirrors the AUDIT_DB row shape for downstream consumption
 *
 * Explicitly NOT in this MVP:
 *   - Event-based enumeration of ALL historical holders (paginated getLogs)
 *     — out of scope for the 3h task, flagged as a follow-up. The operator
 *     provides the candidate list for now. Fetching top holders from a block
 *     explorer or the-graph is a separate enhancement.
 *   - GaugeController gauge-weight vote enumeration — this is just the
 *     balance read, not the vote direction. Richer per-proposal data is a
 *     separate follow-up task.
 *   - All-chain support beyond Ethereum mainnet. Curve + Balancer + Frax
 *     all run their VotingEscrow on mainnet, so this is sufficient for the
 *     cluster entries; L2 veToken forks would need their own --chain flag.
 *
 * Usage:
 *
 *   pop org audit-vetoken \
 *     --escrow 0x5f3b5DfEb7B28CDbD7FAba78963EE202a494e2A2 \
 *     --holders 0x989a...,0x7a16...,0xe3c4... \
 *     [--top 10] [--chain 1] [--json]
 *
 * Dogfood against Curve VotingEscrow (mainnet addresses from
 * docs/audits/curve-dao.md) is the acceptance test.
 */

import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import { resolveNetworkConfig } from '../../config/networks';
import * as output from '../../lib/output';

// Minimal view-surface ABI for any veCRV-family VotingEscrow. Contract uses
// Vyper's `public(HashMap[address, ...])` to expose these as implicit getters.
// Curve's VotingEscrow ships these; Balancer's veBAL, Frax's veFXS, and
// Convex's vlCVX all follow the same interface.
const VE_VIEW_ABI = [
  'function balanceOf(address addr) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function totalSupplyAt(uint256 block) view returns (uint256)',
  'function locked__end(address addr) view returns (uint256)',
  'function token() view returns (address)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
];

interface AuditVetokenArgs {
  escrow: string;
  holders: string;
  top?: number;
  chain?: number;
  rpc?: string;
  json?: boolean;
}

interface HolderRow {
  address: string;
  veBalance: string;
  veBalanceNum: number;
  sharePct: string;
  sharePctNum: number;
  lockEnd?: number | null;
  lockEndIso?: string | null;
}

export const auditVetokenHandler = {
  builder: (yargs: Argv) => yargs
    .option('escrow', {
      type: 'string',
      describe: 'VotingEscrow contract address (veCRV, veBAL, veFXS, …)',
      demandOption: true,
    })
    .option('holders', {
      type: 'string',
      describe: 'Comma-separated list of candidate holder addresses to rank',
      demandOption: true,
    })
    .option('top', {
      type: 'number',
      describe: 'Limit output to the top N holders by current veBalance',
      default: 10,
    })
    .option('chain', { type: 'number', describe: 'Chain ID (default: Ethereum mainnet)', default: 1 })
    .option('rpc', { type: 'string', describe: 'RPC URL override' }),

  handler: async (argv: ArgumentsCamelCase<AuditVetokenArgs>) => {
    const spin = output.spinner('Probing VotingEscrow balances...');
    spin.start();

    try {
      // HB#445 UX fix: ethers.utils.isAddress rejects mixed-case-wrong-checksum
      // addresses. Operators frequently paste from explorers with inconsistent
      // case. Normalize to lowercase before validation, which isAddress accepts
      // as canonical EIP-55-lowercase-form.
      const escrow = argv.escrow.trim().toLowerCase();
      if (!ethers.utils.isAddress(escrow)) {
        spin.stop();
        output.error(`Invalid escrow address: ${escrow}`);
        process.exit(1);
        return;
      }

      const holderAddrs = argv.holders
        .split(',')
        .map(a => a.trim().toLowerCase())
        .filter(a => a.length > 0);

      for (const h of holderAddrs) {
        if (!ethers.utils.isAddress(h)) {
          spin.stop();
          output.error(`Invalid holder address: ${h}`);
          process.exit(1);
          return;
        }
      }
      if (holderAddrs.length === 0) {
        spin.stop();
        output.error('--holders must contain at least one address');
        process.exit(1);
        return;
      }

      const networkConfig = resolveNetworkConfig(argv.chain ?? 1);
      const rpc = argv.rpc || networkConfig.resolvedRpc;
      const provider = new ethers.providers.JsonRpcProvider(rpc, networkConfig.chainId);

      const ve = new ethers.Contract(escrow, VE_VIEW_ABI, provider);

      // Read metadata first so we fail fast on wrong-shape contracts.
      let veName = 'unknown';
      let veSymbol = 'unknown';
      let veTokenAddr = '0x0';
      try {
        [veName, veSymbol, veTokenAddr] = await Promise.all([
          ve.name(),
          ve.symbol(),
          ve.token(),
        ]);
      } catch {
        // Vyper public getters sometimes mis-ABI; don't fail the whole audit
        // if metadata reads fail — just label unknown and continue.
      }

      const totalSupplyBn = await ve.totalSupply();
      const totalSupplyNum = Number(ethers.utils.formatUnits(totalSupplyBn, 18));

      // Parallel balanceOf + locked__end reads
      const rows: HolderRow[] = await Promise.all(
        holderAddrs.map(async (addr) => {
          const [balBn, lockEnd] = await Promise.all([
            ve.balanceOf(addr).catch(() => ethers.BigNumber.from(0)),
            ve.locked__end(addr).catch(() => null),
          ]);
          const balNum = Number(ethers.utils.formatUnits(balBn, 18));
          const sharePctNum = totalSupplyNum > 0 ? (balNum / totalSupplyNum) * 100 : 0;
          const lockEndNum = lockEnd ? Number(lockEnd.toString()) : null;
          return {
            address: addr,
            veBalance: balNum.toFixed(4),
            veBalanceNum: balNum,
            sharePct: sharePctNum.toFixed(2) + '%',
            sharePctNum,
            lockEnd: lockEndNum,
            lockEndIso: lockEndNum && lockEndNum > 0 ? new Date(lockEndNum * 1000).toISOString() : null,
          };
        }),
      );

      rows.sort((a, b) => b.veBalanceNum - a.veBalanceNum);

      const topN = rows.slice(0, argv.top ?? 10);
      const topShareAggregate = topN.reduce((a, r) => a + r.sharePctNum, 0);

      spin.stop();

      if (argv.json || output.isJsonMode()) {
        const artifact = {
          contract: escrow,
          chain: argv.chain ?? 1,
          escrowName: veName,
          escrowSymbol: veSymbol,
          underlyingToken: veTokenAddr,
          totalSupply: totalSupplyBn.toString(),
          totalSupplyHuman: totalSupplyNum.toFixed(4),
          probedHolderCount: holderAddrs.length,
          topHolders: topN,
          topNAggregateSharePct: topShareAggregate.toFixed(2) + '%',
          topHolderSharePct: topN[0]?.sharePct || '0%',
          method: 'veBalance-via-balanceOf',
          note:
            'Snapshot is current-time decayed balance. veToken voting power decays linearly over the lock period; re-run for a temporal delta.',
        };
        output.json(artifact);
        return;
      }

      output.info(`\n  veToken: ${veName} (${veSymbol}) @ ${escrow}`);
      output.info(`  Underlying: ${veTokenAddr}`);
      output.info(`  Total supply: ${totalSupplyNum.toFixed(4)}`);
      output.info(`  Probed: ${holderAddrs.length} candidate holder(s)`);
      output.info(`\n  Top ${topN.length} by current veBalance:\n`);

      const table = topN.map((r, i) => [
        `${i + 1}`,
        r.address,
        r.veBalance,
        r.sharePct,
        r.lockEndIso || '(no lock)',
      ]);
      output.table(['#', 'Holder', 'veBalance', 'Share', 'Lock end'], table);

      output.info(
        `\n  Top ${topN.length} aggregate share: ${topShareAggregate.toFixed(2)}% of total supply`,
      );
      output.info(`  Top 1 share: ${topN[0]?.sharePct || '0%'}`);
      output.info(
        `\n  Note: snapshot is current-time decayed balance. veToken voting power decays linearly over the lock period; re-run for a temporal delta.`,
      );
    } catch (err: any) {
      spin.stop();
      output.error(err.message || String(err));
      process.exit(1);
    }
  },
};
