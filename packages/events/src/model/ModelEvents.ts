/**
 * All supported model lifecycle event names.
 *
 * "Before" events (creating, updating, saving, deleting, restoring)
 * can return `false` from a listener to cancel the operation.
 *
 * "After" events (created, updated, saved, deleted, restored, retrieved)
 * are informational and cannot cancel anything.
 */
export type ModelEventName =
  | 'retrieved'
  | 'creating'
  | 'created'
  | 'updating'
  | 'updated'
  | 'saving'
  | 'saved'
  | 'deleting'
  | 'deleted'
  | 'forceDeleting'
  | 'forceDeleted'
  | 'restoring'
  | 'restored'
  | 'trashed'

/** "Before" events that can be cancelled by returning false. */
export const CANCELLABLE_EVENTS: ModelEventName[] = [
  'creating',
  'updating',
  'saving',
  'deleting',
  'forceDeleting',
  'restoring',
]

export function isCancellable(event: ModelEventName): boolean {
  return CANCELLABLE_EVENTS.includes(event)
}
