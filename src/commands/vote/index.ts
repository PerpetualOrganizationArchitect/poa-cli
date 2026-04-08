import type { Argv } from 'yargs';
import { createHandler } from './create';
import { castHandler } from './cast';
import { listHandler } from './list';
import { announceHandler } from './announce';

export function registerVoteCommands(yargs: Argv) {
  return yargs
    .command('create', 'Create a proposal', createHandler.builder, createHandler.handler)
    .command('cast', 'Cast a vote', castHandler.builder, castHandler.handler)
    .command('list', 'List proposals', listHandler.builder, listHandler.handler)
    .command('announce', 'Announce proposal winner', announceHandler.builder, announceHandler.handler)
    .demandCommand(1, 'Please specify a vote action');
}
