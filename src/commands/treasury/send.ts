import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import { createSigner } from '../../lib/signer';
import { createWriteContract } from '../../lib/contracts';
import { executeTx } from '../../lib/tx';
import { pinJson } from '../../lib/ipfs';
import { stringToBytes, ipfsCidToBytes32 } from '../../lib/encoding';
import { resolveOrgModules } from '../../lib/resolve';
import { resolveVotingContracts } from '../vote/helpers';
import * as output from '../../lib/output';

interface SendArgs {
  org: string;
  to?: string;
  amount?: number;
  recipients?: string;
  token: string;
  duration: number;
  chain?: number;
  rpc?: string;
  'private-key'?: string;
  'dry-run'?: boolean;
}

const ERC20_ABI = ['function transfer(address to, uint256 amount) returns (bool)'];

export const sendHandler = {
  builder: (yargs: Argv) => yargs
    .option('to', { type: 'string', describe: 'Recipient address (single recipient)' })
    .option('amount', { type: 'number', describe: 'Amount to send (single recipient)' })
    .option('recipients', { type: 'string', describe: 'JSON array for batch: [{"to":"0x...","amount":5},...]' })
    .option('token', { type: 'string', default: 'native', describe: 'Token address or "native" for xDAI' })
    .option('duration', { type: 'number', default: 60, describe: 'Vote duration in minutes' }),

  handler: async (argv: ArgumentsCamelCase<SendArgs>) => {
    const spin = output.spinner('Creating transfer proposal...');
    spin.start();

    try {
      const modules = await resolveOrgModules(argv.org, argv.chain);
      const votingContracts = await resolveVotingContracts(argv.org, argv.chain);
      const { signer } = createSigner({ privateKey: argv.privateKey as string, chainId: argv.chain, rpcUrl: argv.rpc as string });

      const hybridVotingAddr = votingContracts.hybridVotingAddress;
      if (!hybridVotingAddr) throw new Error('No HybridVoting found');

      const isNative = argv.token === 'native';
      const tokenLabel = isNative ? 'xDAI' : (argv.token as string);

      // Build recipient list from either --to/--amount or --recipients
      let recipientList: Array<{ to: string; amount: number }>;
      if (argv.recipients) {
        try {
          recipientList = JSON.parse(argv.recipients as string);
          if (!Array.isArray(recipientList) || recipientList.length === 0) throw new Error('empty');
          if (recipientList.length > 8) throw new Error('Executor supports max 8 calls per batch');
        } catch (e: any) {
          throw new Error(`--recipients must be JSON array: [{"to":"0x...","amount":5},...]. ${e.message}`);
        }
      } else if (argv.to && argv.amount) {
        recipientList = [{ to: argv.to as string, amount: argv.amount as number }];
      } else {
        throw new Error('Provide either --to + --amount, or --recipients for batch send');
      }

      // Encode calls for each recipient
      const calls: Array<[string, ethers.BigNumber, string]> = [];
      let totalAmount = 0;
      for (const r of recipientList) {
        const amountWei = ethers.utils.parseEther(r.amount.toString());
        totalAmount += r.amount;
        if (isNative) {
          calls.push([r.to, amountWei, '0x']);
        } else {
          const iface = new ethers.utils.Interface(ERC20_ABI);
          const transferData = iface.encodeFunctionData('transfer', [r.to, amountWei]);
          calls.push([argv.token as string, ethers.BigNumber.from(0), transferData]);
        }
      }

      const recipientSummary = recipientList.map(r => `${r.amount} ${tokenLabel} → ${r.to.slice(0, 10)}...`).join(', ');
      const proposalMeta = {
        description: `Transfer ${totalAmount} ${tokenLabel} from Executor: ${recipientSummary}. ${recipientList.length} recipient(s).`,
        optionNames: [`Send ${totalAmount} ${tokenLabel} (${recipientList.length} recipients)`, 'Do not send'],
        createdAt: Date.now(),
      };

      spin.text = 'Pinning proposal metadata...';
      const cid = await pinJson(JSON.stringify(proposalMeta));
      const descriptionHash = ipfsCidToBytes32(cid);
      const title = stringToBytes(`Send ${totalAmount} ${tokenLabel} to ${recipientList.length} recipient(s)`);

      const batches = [calls, []];

      spin.text = 'Creating proposal...';
      const contract = createWriteContract(hybridVotingAddr, 'HybridVotingNew', signer);
      const result = await executeTx(
        contract,
        'createProposal',
        [title, descriptionHash, argv.duration, 2, batches, []],
        { dryRun: argv.dryRun }
      );

      spin.stop();

      if (result.success) {
        const proposalEvent = result.logs?.find(l => l.name === 'NewProposal');
        output.success('Transfer proposal created', {
          proposalId: proposalEvent?.args?.id?.toString(),
          txHash: result.txHash,
          explorerUrl: result.explorerUrl,
          totalAmount: totalAmount.toString(),
          token: tokenLabel,
          recipients: recipientList.length,
        });
      } else {
        output.error('Proposal creation failed', { error: result.error, errorCode: result.errorCode });
        process.exit(2);
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
