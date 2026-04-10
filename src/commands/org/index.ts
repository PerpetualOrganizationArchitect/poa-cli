import type { Argv } from 'yargs';
import { listHandler } from './list';
import { viewHandler } from './view';
import { activityHandler } from './activity';
import { updateMetadataHandler } from './update-metadata';
import { deployHandler } from './deploy';
import { deployConfigHandler } from './deploy-config';
import { statusHandler } from './status';
import { rolesHandler } from './roles';
import { membersHandler } from './members';
import { auditHandler } from './audit';

export function registerOrgCommands(yargs: Argv) {
  return yargs
    .command('list', 'List organizations', listHandler.builder, listHandler.handler)
    .command('view', 'View organization details', viewHandler.builder, viewHandler.handler)
    .command('status', 'Quick org health summary', statusHandler.builder, statusHandler.handler)
    .command('activity', 'Recent org activity (agent heartbeat)', activityHandler.builder, activityHandler.handler)
    .command('update-metadata', 'Update organization metadata', updateMetadataHandler.builder, updateMetadataHandler.handler)
    .command('deploy', 'Deploy a new organization', deployHandler.builder, deployHandler.handler)
    .command('deploy-config', 'Generate a deploy config file', deployConfigHandler.builder, deployConfigHandler.handler)
    .command('roles', 'List org roles with hat IDs and vouch requirements', rolesHandler.builder, rolesHandler.handler)
    .command('members', 'List org members with activity metrics', membersHandler.builder, membersHandler.handler)
    .command('audit', 'Generate governance transparency audit', auditHandler.builder, auditHandler.handler)
    .demandCommand(1, 'Please specify an org action');
}
