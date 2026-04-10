import type { Argv } from 'yargs';
import { createHandler } from './create';
import { castHandler } from './cast';
import { listHandler } from './list';
import { announceHandler } from './announce';
import { executeHandler } from './execute';
import { announceAllHandler } from './announce-all';

export function registerVoteCommands(yargs: Argv) {
  return yargs
    .command('create', 'Create a proposal', createHandler.builder, createHandler.handler)
    .command('cast', 'Cast a vote', castHandler.builder, castHandler.handler)
    .command('list', 'List proposals', listHandler.builder, listHandler.handler)
    .command('announce', 'Announce proposal winner', announceHandler.builder, announceHandler.handler)
    .command('execute', 'Execute a passed proposal\'s calls', executeHandler.builder, executeHandler.handler)
    .command('announce-all', 'Announce all ended proposals', announceAllHandler.builder, announceAllHandler.handler)
    .demandCommand(1, 'Please specify a vote action');
}
