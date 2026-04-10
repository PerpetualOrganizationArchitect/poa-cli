import type { Argv, ArgumentsCamelCase } from 'yargs';
import { ethers } from 'ethers';
import { createSigner } from '../../lib/signer';
import { createWriteContract } from '../../lib/contracts';
import { executeTx } from '../../lib/tx';
import { pinJson } from '../../lib/ipfs';
import { stringToBytes, ipfsCidToBytes32 } from '../../lib/encoding';
import * as output from '../../lib/output';
import { resolveEducationContracts } from './helpers';

interface CreateModuleArgs {
  org: string;
  name: string;
  description?: string;
  link?: string;
  payout: number;
  quiz?: string;
  answers?: string;
  'correct-answer': number;
  chain?: number;
  rpc?: string;
  'private-key'?: string;
  'dry-run'?: boolean;
}

export const createModuleHandler = {
  builder: (yargs: Argv) => yargs
    .option('name', { type: 'string', demandOption: true, describe: 'Module title' })
    .option('description', { type: 'string', describe: 'Module description' })
    .option('link', { type: 'string', describe: 'External learning resource URL' })
    .option('payout', { type: 'number', demandOption: true, describe: 'PT reward for completion' })
    .option('quiz', { type: 'string', describe: 'JSON array of question strings: \'["Q1?", "Q2?"]\'' })
    .option('answers', { type: 'string', describe: 'JSON array of option arrays: \'[["A","B"],["C","D"]]\'' })
    .option('correct-answer', { type: 'number', demandOption: true, describe: 'Index of correct answer (0-based)' }),

  handler: async (argv: ArgumentsCamelCase<CreateModuleArgs>) => {
    const spin = output.spinner('Creating education module...');
    spin.start();

    try {
      const { educationHubAddress } = await resolveEducationContracts(argv.org, argv.chain);
      const { signer } = createSigner({ privateKey: argv.privateKey as string, chainId: argv.chain, rpcUrl: argv.rpc as string });

      // Build module metadata JSON
      let quiz: string[] = [];
      let answers: string[][] = [];
      if (argv.quiz) {
        try { quiz = JSON.parse(argv.quiz); } catch { throw new Error('--quiz must be valid JSON array of strings'); }
      }
      if (argv.answers) {
        try { answers = JSON.parse(argv.answers); } catch { throw new Error('--answers must be valid JSON array of string arrays'); }
      }

      if (quiz.length > 0 && answers.length > 0 && quiz.length !== answers.length) {
        throw new Error(`Quiz has ${quiz.length} questions but ${answers.length} answer sets. They must match.`);
      }

      const metadata = {
        name: argv.name,
        description: argv.description || '',
        link: argv.link || '',
        quiz,
        answers,
      };

      spin.text = 'Pinning module metadata to IPFS...';
      const cid = await pinJson(JSON.stringify(metadata));
      const contentHash = ipfsCidToBytes32(cid);

      const titleBytes = stringToBytes(argv.name);
      const payoutWei = ethers.utils.parseUnits(argv.payout.toString(), 18);
      const correctAnswer = argv.correctAnswer;

      spin.text = 'Sending transaction...';
      const contract = createWriteContract(educationHubAddress, 'EducationHubNew', signer);
      const result = await executeTx(
        contract,
        'createModule',
        [titleBytes, contentHash, payoutWei, correctAnswer],
        { dryRun: argv.dryRun }
      );

      spin.stop();

      if (result.success) {
        output.success('Education module created', {
          txHash: result.txHash, explorerUrl: result.explorerUrl,
          ipfsCid: cid,
          payout: `${argv.payout} PT`,
        });
      } else {
        output.error('Module creation failed', { error: result.error, errorCode: result.errorCode });
        process.exit(2);
      }
    } catch (err: any) {
      spin.stop();
      output.error(err.message);
      process.exit(1);
    }
  },
};
