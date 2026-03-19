import { Application } from '../application/Application.ts'
import { SessionManager } from '../session/SessionManager.ts'

/**
 * Access the session manager.
 *
 * @example session()  // SessionManager instance
 */
export function session(): SessionManager {
  return Application.getInstance().make(SessionManager)
}
