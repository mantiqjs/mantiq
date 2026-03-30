/**
 * Studio configuration.
 *
 * Panels are auto-discovered from app/Studio/.
 * This config file is optional — only needed for advanced settings.
 */
export default {
  /**
   * Explicit panel registration (optional).
   * If empty, panels are auto-discovered from app/Studio/.
   */
  panels: [],

  /**
   * Default auth guard for all panels.
   * Each panel can override this with its own guard() method.
   */
  guard: 'web',

  /**
   * Login URL — where to redirect unauthenticated users.
   */
  loginUrl: '/login',
}
