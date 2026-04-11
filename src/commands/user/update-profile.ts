import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import { createSigner } from '../../lib/signer';
import { executeTx } from '../../lib/tx';
import { pinJson } from '../../lib/ipfs';
import { ipfsCidToBytes32 } from '../../lib/encoding';
import { query } from '../../lib/subgraph';
import * as output from '../../lib/output';

interface UpdateProfileArgs {
  org: string;
  bio?: string;
  avatar?: string;
  github?: string;
  twitter?: string;
  website?: string;
  chain?: number;
  rpc?: string;
  'private-key'?: string;
  'dry-run'?: boolean;
}

export const updateProfileHandler = {
  builder: (yargs: Argv) => yargs
    .option('bio', { type: 'string', describe: 'Profile bio (max 280 chars)' })
    .option('avatar', { type: 'string', describe: 'Avatar IPFS CID (Qm...)' })
    .option('github', { type: 'string', describe: 'GitHub username' })
    .option('twitter', { type: 'string', describe: 'Twitter/X handle' })
    .option('website', { type: 'string', describe: 'Website URL' }),

  handler: async (argv: ArgumentsCamelCase<UpdateProfileArgs>) => {
    const spin = output.spinner('Updating profile...');
    spin.start();

    try {
      if (!argv.bio && !argv.avatar && !argv.github && !argv.twitter && !argv.website) {
        throw new Error('Provide at least one field: --bio, --avatar, --github, --twitter, --website');
      }

      // Get UAR address
      const uarResult = await query<any>(`{ universalAccountRegistries(first: 1) { id } }`, {}, argv.chain);
      const uarAddr = uarResult.universalAccountRegistries?.[0]?.id;
      if (!uarAddr) throw new Error('UniversalAccountRegistry not found');

      const { signer } = createSigner({ privateKey: argv.privateKey as string, chainId: argv.chain, rpcUrl: argv.rpc as string });
      const address = await signer.getAddress();

      // Merge with existing metadata
      spin.text = 'Fetching current profile...';
      const existingResult = await query<any>(`{ account(id: "${address.toLowerCase()}") { metadata { bio avatar github twitter website } } }`, {}, argv.chain);
      const existing = existingResult.account?.metadata || {};

      const metadata: Record<string, string> = {};
      if (argv.bio !== undefined || existing.bio) metadata.bio = (argv.bio as string) ?? existing.bio ?? '';
      if (argv.avatar !== undefined || existing.avatar) metadata.avatar = (argv.avatar as string) ?? existing.avatar ?? '';
      if (argv.github !== undefined || existing.github) metadata.github = (argv.github as string) ?? existing.github ?? '';
      if (argv.twitter !== undefined || existing.twitter) metadata.twitter = (argv.twitter as string) ?? existing.twitter ?? '';
      if (argv.website !== undefined || existing.website) metadata.website = (argv.website as string) ?? existing.website ?? '';

      if (metadata.bio && metadata.bio.length > 280) {
        throw new Error(`Bio too long: ${metadata.bio.length}/280 chars`);
      }

      // Pin to IPFS
      spin.text = 'Pinning metadata...';
      const cid = await pinJson(JSON.stringify(metadata));
      const metadataHash = ipfsCidToBytes32(cid);

      // Send tx
      spin.text = 'Sending transaction...';
      const uarAbi = require('../../abi/UniversalAccountRegistry.json');
      const contract = new ethers.Contract(uarAddr, uarAbi, signer);
      const result = await executeTx(contract, 'setProfileMetadata', [metadataHash], { dryRun: argv.dryRun });

      spin.stop();

      if (result.success) {
        output.success('Profile updated', {
          txHash: result.txHash,
          explorerUrl: result.explorerUrl,
          ipfsCid: cid,
          ...metadata,
          sponsored: result.sponsored || false,
        });
      } else {
        output.error('Profile update failed', { error: result.error, errorCode: result.errorCode });
        process.exit(2);
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
