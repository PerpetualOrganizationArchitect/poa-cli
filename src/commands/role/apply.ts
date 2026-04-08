import type { Argv, ArgumentsCamelCase } from 'yargs';
import { createSigner } from '../../lib/signer';
import { createWriteContract } from '../../lib/contracts';
import { executeTx } from '../../lib/tx';
import { pinJson } from '../../lib/ipfs';
import { ipfsCidToBytes32 } from '../../lib/encoding';
import { resolveOrgModules, requireModule } from '../../lib/resolve';
import * as output from '../../lib/output';

interface ApplyArgs {
  org?: string;
  hat: string;
  notes?: string;
  experience?: string;
  chain?: number;
  rpc?: string;
  'private-key'?: string;
  'dry-run'?: boolean;
}

export const applyHandler = {
  builder: (yargs: Argv) => yargs
    .option('hat', { type: 'string', demandOption: true, describe: 'Hat ID of the role to apply for' })
    .option('notes', { type: 'string', describe: 'Application notes' })
    .option('experience', { type: 'string', describe: 'Relevant experience' }),

  handler: async (argv: ArgumentsCamelCase<ApplyArgs>) => {
    const spin = output.spinner('Applying for role...');
    spin.start();

    try {
      const modules = await resolveOrgModules(argv.org, argv.chain);
      const eligibilityAddr = requireModule(modules, 'eligibilityModuleAddress');
      const { signer } = createSigner({ privateKey: argv.privateKey as string, chainId: argv.chain, rpcUrl: argv.rpc as string });

      // Upload application metadata to IPFS
      const applicationData = {
        notes: argv.notes || '',
        experience: argv.experience || '',
        appliedAt: Date.now(),
      };
      spin.text = 'Pinning application to IPFS...';
      const cid = await pinJson(JSON.stringify(applicationData));
      const applicationHash = ipfsCidToBytes32(cid);

      spin.text = 'Sending transaction...';
      const contract = createWriteContract(eligibilityAddr, 'EligibilityModuleNew', signer);
      const result = await executeTx(contract, 'applyForRole', [argv.hat, applicationHash], { dryRun: argv.dryRun });
      spin.stop();

      if (result.success) {
        output.success(`Applied for role (hat ${argv.hat})`, {
          txHash: result.txHash,
          explorerUrl: result.explorerUrl,
          ipfsCid: cid,
        });
      } else {
        output.error('Application failed', { error: result.error, errorCode: result.errorCode });
        process.exit(2);
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
