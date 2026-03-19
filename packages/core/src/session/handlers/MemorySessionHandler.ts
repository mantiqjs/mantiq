import type { SessionHandler } from '../../contracts/Session.ts'

interface SessionEntry {
  data: string
  lastActivity: number
}

/**
 * In-memory session handler. Fast, but sessions are lost on restart.
 * Good for development and testing.
 */
export class MemorySessionHandler implements SessionHandler {
  private sessions = new Map<string, SessionEntry>()

  async read(sessionId: string): Promise<string> {
    return this.sessions.get(sessionId)?.data ?? ''
  }

  async write(sessionId: string, data: string): Promise<void> {
    this.sessions.set(sessionId, { data, lastActivity: Date.now() })
  }

  async destroy(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId)
  }

  async gc(maxLifetimeSeconds: number): Promise<void> {
    const cutoff = Date.now() - maxLifetimeSeconds * 1000
    for (const [id, entry] of this.sessions) {
      if (entry.lastActivity < cutoff) {
        this.sessions.delete(id)
      }
    }
  }
}
