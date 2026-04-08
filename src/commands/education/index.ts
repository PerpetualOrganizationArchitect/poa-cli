import type { Argv } from 'yargs';
import { createModuleHandler } from './create-module';
import { listHandler } from './list';
import { completeHandler } from './complete';

export function registerEducationCommands(yargs: Argv) {
  return yargs
    .command('create', 'Create a learning module', createModuleHandler.builder, createModuleHandler.handler)
    .command('list', 'List education modules', listHandler.builder, listHandler.handler)
    .command('complete', 'Complete a module', completeHandler.builder, completeHandler.handler)
    .demandCommand(1, 'Please specify an education action');
}
