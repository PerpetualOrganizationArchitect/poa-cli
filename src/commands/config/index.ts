import type { Argv } from 'yargs';
import { showHandler } from './show';
import { validateHandler } from './validate';

export function registerConfigCommands(yargs: Argv) {
  return yargs
    .command('show', 'Show active configuration', showHandler.builder, showHandler.handler)
    .command('validate', 'Test RPC and subgraph connectivity', validateHandler.builder, validateHandler.handler)
    .demandCommand(1, 'Please specify a config action');
}
