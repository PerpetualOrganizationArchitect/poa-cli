import type { Argv } from 'yargs';
import { statusHandler } from './status';

export function registerPaymasterCommands(yargs: Argv) {
  return yargs
    .command('status', 'View paymaster status and deposit', statusHandler.builder, statusHandler.handler)
    .demandCommand(1, 'Please specify a paymaster action');
}
