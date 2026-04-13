import type { Argv } from 'yargs';
import { statusHandler } from './status';
import { subscribeHandler } from './subscribe';
import { readHandler } from './read';
import { listHandler } from './list';
import { snapshotHandler } from './snapshot';
import { migrateHandler } from './migrate';
import { appendLessonHandler } from './append-lesson';
import { editLessonHandler } from './edit-lesson';
import { removeLessonHandler } from './remove-lesson';
import { newProjectHandler } from './new-project';
import { advanceStageHandler } from './advance-stage';
import { removeProjectHandler } from './remove-project';

export function registerBrainCommands(yargs: Argv) {
  return yargs
    .command('status', 'Show local brain layer state (Helia + CRDT sync)', statusHandler.builder, statusHandler.handler)
    .command('subscribe', 'Subscribe to a doc topic; fetch + merge announced blocks (or --log-only)', subscribeHandler.builder, subscribeHandler.handler)
    .command('read', 'Load a brain doc from local state and print its contents', readHandler.builder, readHandler.handler)
    .command('list', 'List all known brain docs with their current head CIDs', listHandler.builder, listHandler.handler)
    .command('snapshot', 'Project a brain doc to markdown on disk (step 7)', snapshotHandler.builder, snapshotHandler.handler)
    .command('migrate', 'Import a hand-written markdown file into a brain doc (step 8)', migrateHandler.builder, migrateHandler.handler)
    .command('append-lesson', 'Append a lesson to a brain doc (signed + gossipsub-published)', appendLessonHandler.builder, appendLessonHandler.handler)
    .command('edit-lesson', 'Update fields on an existing brain lesson (in-place)', editLessonHandler.builder, editLessonHandler.handler)
    .command('remove-lesson', 'Soft-delete a brain lesson (tombstone; filtered from snapshot output)', removeLessonHandler.builder, removeLessonHandler.handler)
    .command('new-project', 'Create a project entry in pop.brain.projects (signed + gossipsub-published)', newProjectHandler.builder, newProjectHandler.handler)
    .command('advance-stage', 'Move a project forward in the lifecycle (propose → discuss → ... → ship)', advanceStageHandler.builder, advanceStageHandler.handler)
    .command('remove-project', 'Soft-delete a project entry (tombstone; filtered from snapshot output)', removeProjectHandler.builder, removeProjectHandler.handler)
    .demandCommand(1, 'Please specify a brain action');
}
