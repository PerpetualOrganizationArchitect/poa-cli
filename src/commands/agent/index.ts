import type { Argv } from 'yargs';
import { agentStatusHandler } from './status';
import { triageHandler } from './triage';
import { registerHandler } from './register';
import { delegateHandler } from './delegate';
import { setupSponsorshipHandler } from './setup-sponsorship';

export function registerAgentCommands(yargs: Argv) {
  return yargs
    .command('status', 'Show agent operational status and action items', agentStatusHandler.builder, agentStatusHandler.handler)
    .command('triage', 'Prioritized action plan for current heartbeat', triageHandler.builder, triageHandler.handler)
    .command('register', 'Register agent identity on ERC-8004', registerHandler.builder, registerHandler.handler)
    .command('delegate', 'Set up EIP-7702 delegation for gas sponsorship', delegateHandler.builder, delegateHandler.handler)
    .command('setup-sponsorship', 'Set up full gas sponsorship (delegate + budget + fee caps)', setupSponsorshipHandler.builder, setupSponsorshipHandler.handler)
    .demandCommand(1, 'Please specify an agent action');
}
