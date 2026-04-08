import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import { createSigner } from '../../lib/signer';
import { createWriteContract } from '../../lib/contracts';
import { executeTx } from '../../lib/tx';
import { pinJson, pinFile } from '../../lib/ipfs';
import { stringToBytes, ipfsCidToBytes32 } from '../../lib/encoding';
import { query } from '../../lib/subgraph';
import { resolveOrgId } from '../../lib/resolve';
import { FETCH_INFRASTRUCTURE_ADDRESSES } from '../../queries/infrastructure';
import { FETCH_ORG_BY_ID } from '../../queries/org';
import type { InfrastructureAddresses } from '../../queries/infrastructure';
import * as output from '../../lib/output';
import fs from 'fs';

interface UpdateMetadataArgs {
  org: string;
  name?: string;
  description?: string;
  logo?: string;
  links?: string;
  'background-color'?: string;
  'hide-treasury'?: boolean;
  chain?: number;
  rpc?: string;
  'private-key'?: string;
  'dry-run'?: boolean;
}

export const updateMetadataHandler = {
  builder: (yargs: Argv) => yargs
    .option('name', { type: 'string', describe: 'New org name' })
    .option('description', { type: 'string', describe: 'Org description' })
    .option('logo', { type: 'string', describe: 'Path to logo image file' })
    .option('links', { type: 'string', describe: 'JSON array of {name, url} links' })
    .option('background-color', { type: 'string', describe: 'Background color hex' })
    .option('hide-treasury', { type: 'boolean', describe: 'Hide treasury in UI' }),

  handler: async (argv: ArgumentsCamelCase<UpdateMetadataArgs>) => {
    const spin = output.spinner('Updating organization metadata...');
    spin.start();

    try {
      const { signer } = createSigner({ privateKey: argv.privateKey as string, chainId: argv.chain, rpcUrl: argv.rpc as string });

      // Resolve OrgRegistry address
      const infra = await query<InfrastructureAddresses>(
        FETCH_INFRASTRUCTURE_ADDRESSES,
        {},
        argv.chain
      );

      const orgRegistryAddr = infra.poaManagerContracts?.[0]?.orgRegistryProxy;
      if (!orgRegistryAddr) {
        throw new Error('Could not resolve OrgRegistry address from subgraph');
      }

      // Upload logo to IPFS if provided
      let logoCid: string | null = null;
      if (argv.logo) {
        spin.text = 'Uploading logo to IPFS...';
        const logoBuffer = fs.readFileSync(argv.logo);
        logoCid = await pinFile(logoBuffer);
      }

      // Parse links
      let links: Array<{ name: string; url: string; index?: number }> = [];
      if (argv.links) {
        try {
          links = JSON.parse(argv.links);
        } catch {
          throw new Error('--links must be valid JSON array: [{"name":"...","url":"..."}]');
        }
        // Add index field
        links = links.map((l, i) => ({ ...l, index: i }));
      }

      // Build metadata JSON (must match frontend key order)
      const metadata: any = {
        description: argv.description || '',
        links,
        template: 'default',
        logo: logoCid || null,
        backgroundColor: argv.backgroundColor || null,
        hideTreasury: argv.hideTreasury || false,
      };

      spin.text = 'Pinning metadata to IPFS...';
      const metaCid = await pinJson(JSON.stringify(metadata));
      const metadataHash = ipfsCidToBytes32(metaCid);

      if (!argv.name && !argv.description && !argv.logo && !argv.links) {
        throw new Error('At least one metadata field must be provided (--name, --description, --logo, or --links)');
      }

      // Resolve org name → bytes32 ID
      const orgId = await resolveOrgId(argv.org, argv.chain);

      // If --name not provided, fetch current name to avoid overwriting with empty bytes
      let nameToSend = argv.name;
      if (!nameToSend) {
        spin.text = 'Fetching current org name...';
        const orgData = await query<{ organization: { name: string } | null }>(
          FETCH_ORG_BY_ID,
          { id: orgId },
          argv.chain
        );
        nameToSend = orgData.organization?.name || '';
      }
      const nameBytes = stringToBytes(nameToSend);

      spin.text = 'Sending transaction...';
      const contract = createWriteContract(orgRegistryAddr, 'OrgRegistry', signer);
      const result = await executeTx(
        contract,
        'updateOrgMetaAsAdmin',
        [orgId, nameBytes, metadataHash],
        { dryRun: argv.dryRun }
      );

      spin.stop();

      if (result.success) {
        output.success('Organization metadata updated', {
          txHash: result.txHash, explorerUrl: result.explorerUrl,
          metadataCid: metaCid,
          logoCid: logoCid,
        });
      } else {
        output.error('Metadata update failed', { error: result.error, errorCode: result.errorCode });
        process.exit(2);
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
