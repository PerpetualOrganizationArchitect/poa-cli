import type { Argv } from 'yargs';
import { applyHandler } from './apply';
import { applicationsHandler } from './applications';

export function registerRoleCommands(yargs: Argv) {
  return yargs
    .command('apply', 'Apply for a role', applyHandler.builder, applyHandler.handler)
    .command('applications', 'List role applications', applicationsHandler.builder, applicationsHandler.handler)
    .demandCommand(1, 'Please specify a role action');
}
