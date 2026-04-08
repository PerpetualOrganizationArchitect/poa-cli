import type { Argv } from 'yargs';
import { registerHandler } from './register';
import { joinHandler } from './join';
import { profileHandler } from './profile';

export function registerUserCommands(yargs: Argv) {
  return yargs
    .command('register', 'Register a username', registerHandler.builder, registerHandler.handler)
    .command('join', 'Join an organization', joinHandler.builder, joinHandler.handler)
    .command('profile', 'View user profile', profileHandler.builder, profileHandler.handler)
    .demandCommand(1, 'Please specify a user action');
}
