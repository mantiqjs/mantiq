/**
 * Contract for session handler (persistence layer).
 * Each driver (memory, file, cookie) implements this.
 */
export interface SessionHandler {
  /**
   * Read the session data for the given ID.
   * Returns a serialized string, or empty string if not found.
   */
  read(sessionId: string): Promise<string>

  /**
   * Write session data for the given ID.
   */
  write(sessionId: string, data: string): Promise<void>

  /**
   * Destroy the session with the given ID.
   */
  destroy(sessionId: string): Promise<void>

  /**
   * Garbage-collect expired sessions older than `maxLifetimeSeconds`.
   */
  gc(maxLifetimeSeconds: number): Promise<void>
}

export interface SessionConfig {
  /** Driver name: 'memory' | 'file' | 'cookie' */
  driver: string
  /** Session lifetime in minutes. */
  lifetime: number
  /** Cookie name. */
  cookie: string
  /** Cookie path. */
  path: string
  /** Cookie domain. */
  domain?: string
  /** Send only over HTTPS. */
  secure: boolean
  /** HTTP-only (no JS access). */
  httpOnly: boolean
  /** SameSite attribute. */
  sameSite: 'Lax' | 'Strict' | 'None'
  /** File driver: storage directory. */
  files?: string
}
