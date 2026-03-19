/**
 * A model observer handles lifecycle events for a model.
 *
 * Implement any subset of these methods. Methods matching "before" events
 * (creating, updating, saving, deleting, restoring, forceDeleting) can
 * return `false` to cancel the operation.
 *
 * ```typescript
 * class UserObserver implements ModelObserver {
 *   creating(model: User): boolean | void {
 *     // Normalize email before saving
 *     model.set('email', model.get('email').toLowerCase())
 *   }
 *
 *   created(model: User): void {
 *     // Send welcome email
 *   }
 *
 *   deleting(model: User): boolean | void {
 *     // Prevent deletion of admin users
 *     if (model.get('role') === 'admin') return false
 *   }
 * }
 * ```
 */
export interface ModelObserver {
  retrieved?(model: any): void | Promise<void>
  creating?(model: any): boolean | void | Promise<boolean | void>
  created?(model: any): void | Promise<void>
  updating?(model: any): boolean | void | Promise<boolean | void>
  updated?(model: any): void | Promise<void>
  saving?(model: any): boolean | void | Promise<boolean | void>
  saved?(model: any): void | Promise<void>
  deleting?(model: any): boolean | void | Promise<boolean | void>
  deleted?(model: any): void | Promise<void>
  forceDeleting?(model: any): boolean | void | Promise<boolean | void>
  forceDeleted?(model: any): void | Promise<void>
  restoring?(model: any): boolean | void | Promise<boolean | void>
  restored?(model: any): void | Promise<void>
  trashed?(model: any): void | Promise<void>
}
