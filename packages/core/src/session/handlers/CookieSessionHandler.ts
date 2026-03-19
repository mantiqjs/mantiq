import type { SessionHandler } from '../../contracts/Session.ts'

/**
 * Cookie-based session handler.
 * Session data is stored entirely in the cookie (encrypted by the middleware).
 * No server-side storage needed — ideal for stateless deployments.
 *
 * Size limit: ~4KB per cookie. Suitable for small session payloads.
 */
export class CookieSessionHandler implements SessionHandler {
  private data = new Map<string, string>()

  async read(sessionId: string): Promise<string> {
    return this.data.get(sessionId) ?? ''
  }

  async write(sessionId: string, data: string): Promise<void> {
    this.data.set(sessionId, data)
  }

  async destroy(sessionId: string): Promise<void> {
    this.data.delete(sessionId)
  }

  async gc(_maxLifetimeSeconds: number): Promise<void> {
    // No-op — cookie expiration is handled by the browser
  }

  /**
   * Get the raw data for the session (used by StartSession to write into cookie).
   */
  getDataForCookie(sessionId: string): string {
    return this.data.get(sessionId) ?? ''
  }

  /**
   * Seed session data from cookie value (called before session.start()).
   */
  setDataFromCookie(sessionId: string, data: string): void {
    this.data.set(sessionId, data)
  }
}
