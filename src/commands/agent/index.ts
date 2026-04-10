import type { Argv } from 'yargs';
import { agentStatusHandler } from './status';
import { triageHandler } from './triage';

export function registerAgentCommands(yargs: Argv) {
  return yargs
    .command('status', 'Show agent operational status and action items', agentStatusHandler.builder, agentStatusHandler.handler)
    .command('triage', 'Prioritized action plan for current heartbeat', triageHandler.builder, triageHandler.handler)
    .demandCommand(1, 'Please specify an agent action');
}
