import type { Argv } from 'yargs';
import { createHandler } from './create';
import { listHandler } from './list';
import { deleteHandler } from './delete';
import { proposeHandler } from './propose';

export function registerProjectCommands(yargs: Argv) {
  return yargs
    .command('create', 'Create a new project', createHandler.builder, createHandler.handler)
    .command('propose', 'Propose a new project via governance vote', proposeHandler.builder, proposeHandler.handler)
    .command('list', 'List projects', listHandler.builder, listHandler.handler)
    .command('delete', 'Delete a project', deleteHandler.builder, deleteHandler.handler)
    .demandCommand(1, 'Please specify a project action');
}
