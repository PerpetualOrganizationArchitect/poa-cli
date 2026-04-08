import type { Argv } from 'yargs';
import { listHandler } from './list';
import { viewHandler } from './view';
import { activityHandler } from './activity';
import { updateMetadataHandler } from './update-metadata';
import { deployHandler } from './deploy';

export function registerOrgCommands(yargs: Argv) {
  return yargs
    .command('list', 'List organizations', listHandler.builder, listHandler.handler)
    .command('view', 'View organization details', viewHandler.builder, viewHandler.handler)
    .command('activity', 'Recent org activity (agent heartbeat)', activityHandler.builder, activityHandler.handler)
    .command('update-metadata', 'Update organization metadata', updateMetadataHandler.builder, updateMetadataHandler.handler)
    .command('deploy', 'Deploy a new organization', deployHandler.builder, deployHandler.handler)
    .demandCommand(1, 'Please specify an org action');
}
