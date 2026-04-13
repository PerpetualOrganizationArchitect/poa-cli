import type { Argv, ArgumentsCamelCase } from 'yargs';
import * as output from '../../lib/output';

interface AuditRequestArgs {
  'org-name': string;
  platform: string;
  type: string;
  space?: string;
  members?: number;
  concerns?: string;
  pin?: boolean;
}

const PRICING = {
  free: { name: 'Free Sample', price: '0', description: 'Automated scan — governance health score, Gini, top voters. No narrative analysis.' },
  standard: { name: 'Standard Audit', price: '5 BREAD', description: 'Health score, token distribution, pass rate, risk assessment, recommendations.' },
  deep: { name: 'Deep Audit', price: '10 BREAD', description: 'Standard + treasury analysis + comparative context + counterfactual scenarios.' },
};

export const auditRequestHandler = {
  builder: (yargs: Argv) => yargs
    .option('org-name', { type: 'string', demandOption: true, describe: 'Name of the DAO to audit' })
    .option('platform', { type: 'string', demandOption: true, choices: ['snapshot', 'pop', 'governor', 'moloch'], describe: 'Governance platform' })
    .option('type', { type: 'string', default: 'standard', choices: ['free', 'standard', 'deep'], describe: 'Audit tier' })
    .option('space', { type: 'string', describe: 'Snapshot space ID (e.g. ens.eth)' })
    .option('members', { type: 'number', describe: 'Approximate member count' })
    .option('concerns', { type: 'string', describe: 'Specific governance concerns to investigate' })
    .option('pin', { type: 'boolean', default: false, describe: 'Pin request to IPFS' }),

  handler: async (argv: ArgumentsCamelCase<AuditRequestArgs>) => {
    const tier = PRICING[argv.type as keyof typeof PRICING] || PRICING.standard;
    const orgName = argv.orgName as string;

    const request: any = {
      type: 'audit-request',
      version: '1.0',
      date: new Date().toISOString().split('T')[0],
      client: {
        orgName,
        platform: argv.platform,
        snapshotSpace: argv.space || null,
        memberCount: argv.members || null,
        specificConcerns: argv.concerns || null,
      },
      audit: {
        tier: argv.type,
        tierName: tier.name,
        price: tier.price,
        scope: tier.description,
      },
      auditor: {
        org: 'Argus',
        portfolio: 'https://ipfs.io/ipfs/QmZSJwfbnmxKkRgG4rBtSrBMQXDdqbzfGnayNizRUiozTy',
        protocol: 'https://ipfs.io/ipfs/QmPiSJ25zCromRDF9f66sij8torv8REq4wcz19fRF7gRJ4',
        methodology: 'Automated on-chain analysis via POP CLI. Gini coefficient, voter distribution, pass rate, participation breadth, cross-analysis.',
        completedAudits: '20+ (Gitcoin, Uniswap, Curve, ENS, Lido, Compound, Arbitrum, Optimism, and more)',
        responseTime: '24 hours',
      },
      deliverables: [
        'Governance health score (0-100 with letter grade)',
        'Voting power distribution (Gini coefficient + top voter analysis)',
        'Pass rate assessment (rubber-stamping detection)',
        'Participation breadth metrics',
        'Risk identification and recommendations',
        ...(argv.type === 'deep' ? [
          'Treasury security analysis (Safe threshold, signer activity)',
          'Comparative context (vs DeFi average, vs best-in-class)',
          'Counterfactual voting analysis (what if governance structure differed?)',
        ] : []),
      ],
      payment: {
        acceptedTokens: ['BREAD', 'xDAI', 'USDC', 'ETH'],
        chain: 'Gnosis (preferred), Ethereum, Arbitrum',
        note: tier.price === '0' ? 'Free — no payment required' : `${tier.price} due upon delivery`,
      },
    };

    if (argv.pin) {
      const { pinJson } = require('../../lib/ipfs');
      request.ipfsCid = await pinJson(JSON.stringify(request));
    }

    if (argv.json) {
      output.json(request);
    } else {
      console.log('');
      console.log('  Governance Audit Request');
      console.log('  ' + '═'.repeat(50));
      console.log(`  Client:    ${orgName}`);
      console.log(`  Platform:  ${argv.platform}`);
      if (argv.space) console.log(`  Space:     ${argv.space}`);
      if (argv.members) console.log(`  Members:   ${argv.members}`);
      console.log('');
      console.log(`  Audit Tier: ${tier.name}`);
      console.log(`  Price:      ${tier.price || 'Free'}`);
      console.log(`  Scope:      ${tier.description}`);
      console.log('');
      console.log('  Deliverables:');
      request.deliverables.forEach((d: string) => console.log(`    • ${d}`));
      console.log('');
      console.log('  Auditor: Argus (20+ completed audits)');
      console.log('  Response time: 24 hours');
      if (argv.concerns) console.log(`  Concerns: ${argv.concerns}`);
      if (request.ipfsCid) console.log(`  IPFS: https://ipfs.io/ipfs/${request.ipfsCid}`);
      console.log('');
    }
  },
};
