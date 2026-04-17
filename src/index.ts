#!/usr/bin/env node

import { config as dotenvConfig } from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Load .env: try ~/.pop-agent/.env first (agent-specific), fall back to cwd/.env
const agentEnv = join(homedir(), '.pop-agent', '.env');
if (existsSync(agentEnv)) {
  dotenvConfig({ path: agentEnv });
} else {
  dotenvConfig();
}
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { setJsonMode } from './lib/output';
import * as output from './lib/output';
import { CliError } from './lib/errors';

// Import command registrations
import { registerTaskCommands } from './commands/task';
import { registerProjectCommands } from './commands/project';
import { registerOrgCommands } from './commands/org';
import { registerVoteCommands } from './commands/vote';
import { registerUserCommands } from './commands/user';
import { registerEducationCommands } from './commands/education';
import { registerVouchCommands } from './commands/vouch';
import { registerTokenCommands } from './commands/token';
import { registerTreasuryCommands } from './commands/treasury';
import { registerPaymasterCommands } from './commands/paymaster';
import { registerRoleCommands } from './commands/role';
import { registerConfigCommands } from './commands/config';
import { registerAgentCommands } from './commands/agent';
import { registerBrainCommands } from './commands/brain';
import { registerSubgraphCommands } from './commands/subgraph';

async function main() {
  const cli = yargs(hideBin(process.argv))
    .scriptName('pop')
    .usage('$0 <domain> <action> [options]')
    .command('task <action>', 'Task management', registerTaskCommands)
    .command('project <action>', 'Project management', registerProjectCommands)
    .command('org <action>', 'Organization management', registerOrgCommands)
    .command('vote <action>', 'Governance & voting', registerVoteCommands)
    .command('user <action>', 'User & membership', registerUserCommands)
    .command('education <action>', 'Education modules', registerEducationCommands)
    .command('vouch <action>', 'Vouching system', registerVouchCommands)
    .command('token <action>', 'Participation token requests', registerTokenCommands)
    .command('treasury <action>', 'Treasury & distributions', registerTreasuryCommands)
    .command('paymaster <action>', 'Gas sponsorship (ERC-4337)', registerPaymasterCommands)
    .command('role <action>', 'Role applications', registerRoleCommands)
    .command('config <action>', 'View and validate configuration', registerConfigCommands)
    .command('agent <action>', 'Agent operations & monitoring', registerAgentCommands)
    .command('brain <action>', 'P2P CRDT brain layer (live-sync knowledge)', registerBrainCommands)
    .command('subgraph <action>', 'Subgraph cache management (#459 outage resilience)', registerSubgraphCommands)
    .option('org', {
      type: 'string',
      description: 'Organization ID or name (or set POP_DEFAULT_ORG)',
      global: true,
    })
    .option('chain', {
      type: 'number',
      description: 'Chain ID override',
      global: true,
    })
    .option('rpc', {
      type: 'string',
      description: 'RPC URL override',
      global: true,
    })
    .option('json', {
      type: 'boolean',
      description: 'Output JSON for machine consumption',
      default: false,
      global: true,
    })
    .option('private-key', {
      type: 'string',
      description: 'Private key (hex)',
      global: true,
    })
    .option('dry-run', {
      type: 'boolean',
      description: 'Simulate without sending transactions',
      default: false,
      global: true,
    })
    .option('yes', {
      alias: 'y',
      type: 'boolean',
      description: 'Skip confirmations',
      default: false,
      global: true,
    })
    .option('verbose', {
      alias: 'v',
      type: 'boolean',
      description: 'Debug output',
      default: false,
      global: true,
    })
    .middleware([(argv) => {
      if (argv.json) {
        setJsonMode(true);
      }
      // Fall back to POP_DEFAULT_ORG if --org not provided
      if (!argv.org && process.env.POP_DEFAULT_ORG) {
        argv.org = process.env.POP_DEFAULT_ORG;
      }
    }])
    .strict()
    .demandCommand(1, 'Please specify a command')
    .help()
    .version('0.1.0');

  try {
    await cli.parse();
  } catch (err: any) {
    if (err instanceof CliError) {
      output.error(err.message, { suggestion: err.suggestion });
      process.exit(err.code);
    }
    // yargs handles its own errors (missing args, unknown commands)
    if (err.name !== 'YError') {
      output.error(err.message || 'Unknown error');
      process.exit(1);
    }
  }
}

main();
