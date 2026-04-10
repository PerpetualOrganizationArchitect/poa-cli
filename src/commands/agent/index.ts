import type { Argv } from 'yargs';
import { agentStatusHandler } from './status';

export function registerAgentCommands(yargs: Argv) {
  return yargs
    .command('status', 'Show agent operational status and action items', agentStatusHandler.builder, agentStatusHandler.handler)
    .demandCommand(1, 'Please specify an agent action');
}
