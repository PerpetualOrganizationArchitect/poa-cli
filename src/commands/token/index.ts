import type { Argv } from 'yargs';
import { requestHandler } from './request';
import { approveHandler } from './approve';
import { cancelHandler } from './cancel';
import { requestsHandler } from './requests';
import { balanceHandler } from './balance';

export function registerTokenCommands(yargs: Argv) {
  return yargs
    .command('request', 'Request participation tokens', requestHandler.builder, requestHandler.handler)
    .command('approve', 'Approve a token request', approveHandler.builder, approveHandler.handler)
    .command('cancel', 'Cancel a pending token request', cancelHandler.builder, cancelHandler.handler)
    .command('requests', 'List token requests', requestsHandler.builder, requestsHandler.handler)
    .command('balance', 'Check token balance', balanceHandler.builder, balanceHandler.handler)
    .demandCommand(1, 'Please specify a token action');
}
