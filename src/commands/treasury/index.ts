import type { Argv } from 'yargs';
import { viewHandler } from './view';
import { depositHandler } from './deposit';
import { claimHandler } from './claim';
import { distributionsHandler } from './distributions';
import { optOutHandler } from './opt-out';

export function registerTreasuryCommands(yargs: Argv) {
  return yargs
    .command('view', 'View treasury overview', viewHandler.builder, viewHandler.handler)
    .command('deposit', 'Deposit ERC20 tokens to treasury', depositHandler.builder, depositHandler.handler)
    .command('claim', 'Claim from a distribution', claimHandler.builder, claimHandler.handler)
    .command('distributions', 'List distributions', distributionsHandler.builder, distributionsHandler.handler)
    .command('opt-out', 'Opt out of distributions', optOutHandler.builder, optOutHandler.handler)
    .command('opt-in', 'Opt back into distributions', optOutHandler.builderIn, optOutHandler.handlerIn)
    .demandCommand(1, 'Please specify a treasury action');
}
