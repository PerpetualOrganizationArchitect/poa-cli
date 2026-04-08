import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import { createSigner } from '../../lib/signer';
import { createWriteContract } from '../../lib/contracts';
import { executeTx } from '../../lib/tx';
import { pinJson } from '../../lib/ipfs';
import * as output from '../../lib/output';
import { resolveTokenAddress } from './helpers';

interface RequestArgs {
  org?: string;
  amount: number;
  reason: string;
  chain?: number;
  rpc?: string;
  'private-key'?: string;
  'dry-run'?: boolean;
}

export const requestHandler = {
  builder: (yargs: Argv) => yargs
    .option('amount', { type: 'number', demandOption: true, describe: 'Amount of PT to request' })
    .option('reason', { type: 'string', demandOption: true, describe: 'Reason for the request' }),

  handler: async (argv: ArgumentsCamelCase<RequestArgs>) => {
    const spin = output.spinner('Requesting tokens...');
    spin.start();

    try {
      const { tokenAddress } = await resolveTokenAddress(argv.org, argv.chain);
      const { signer } = createSigner({ privateKey: argv.privateKey as string, chainId: argv.chain, rpcUrl: argv.rpc as string });

      // Upload reason metadata to IPFS (matches frontend pattern)
      const metadata = { reason: argv.reason, submittedAt: Date.now() };
      spin.text = 'Pinning request metadata to IPFS...';
      const cid = await pinJson(JSON.stringify(metadata));

      // requestTokens expects (uint96 amount, string ipfsHash)
      // Amount in 18 decimals, ipfsHash is the CID string (not bytes32)
      const amountWei = ethers.utils.parseUnits(argv.amount.toString(), 18);

      spin.text = 'Sending transaction...';
      const contract = createWriteContract(tokenAddress, 'ParticipationToken', signer);
      const result = await executeTx(contract, 'requestTokens', [amountWei, cid], { dryRun: argv.dryRun });
      spin.stop();

      if (result.success) {
        const requestEvent = result.logs?.find(l => l.name === 'Requested');
        const requestId = requestEvent?.args?.id?.toString();
        output.success('Token request submitted', {
          requestId,
          amount: `${argv.amount} PT`,
          txHash: result.txHash,
          explorerUrl: result.explorerUrl,
        });
      } else {
        output.error('Token request failed', { error: result.error, errorCode: result.errorCode });
        process.exit(2);
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
