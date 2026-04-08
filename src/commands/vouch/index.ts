import type { Argv } from 'yargs';
import { forHandler } from './for';
import { revokeHandler } from './revoke';
import { claimHandler } from './claim';
import { listHandler } from './list';
import { statusHandler } from './status';

export function registerVouchCommands(yargs: Argv) {
  return yargs
    .command('for', 'Vouch for a user to claim a role', forHandler.builder, forHandler.handler)
    .command('revoke', 'Revoke a vouch', revokeHandler.builder, revokeHandler.handler)
    .command('claim', 'Claim a role after receiving enough vouches', claimHandler.builder, claimHandler.handler)
    .command('list', 'List active vouches for an org', listHandler.builder, listHandler.handler)
    .command('status', 'Check vouch status for a user and role', statusHandler.builder, statusHandler.handler)
    .demandCommand(1, 'Please specify a vouch action');
}
