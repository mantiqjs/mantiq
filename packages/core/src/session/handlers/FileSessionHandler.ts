import type { SessionHandler } from '../../contracts/Session.ts'
import { join } from 'node:path'
import { mkdir, readdir, rm, stat } from 'node:fs/promises'

/**
 * File-based session handler. Each session is a JSON file.
 * Survives process restarts. Good for single-server deployments.
 */
export class FileSessionHandler implements SessionHandler {
  private readonly directory: string
  private initialized = false

  constructor(directory: string) {
    this.directory = directory
  }

  async read(sessionId: string): Promise<string> {
    await this.ensureDirectory()
    const file = Bun.file(this.path(sessionId))

    if (!(await file.exists())) return ''

    try {
      return await file.text()
    } catch {
      return ''
    }
  }

  async write(sessionId: string, data: string): Promise<void> {
    await this.ensureDirectory()
    await Bun.write(this.path(sessionId), data)
  }

  async destroy(sessionId: string): Promise<void> {
    try {
      await rm(this.path(sessionId))
    } catch {
      // File might not exist — that's fine
    }
  }

  async gc(maxLifetimeSeconds: number): Promise<void> {
    try {
      const files = await readdir(this.directory)
      const cutoff = Date.now() - maxLifetimeSeconds * 1000

      await Promise.all(
        files
          .filter((f) => f.endsWith('.session'))
          .map(async (f) => {
            const filePath = join(this.directory, f)
            try {
              const s = await stat(filePath)
              if (s.mtimeMs < cutoff) {
                await rm(filePath)
              }
            } catch {
              // Ignore stat errors
            }
          }),
      )
    } catch {
      // Directory might not exist
    }
  }

  private path(sessionId: string): string {
    // Validate session ID to prevent directory traversal
    const safe = sessionId.replace(/[^a-f0-9]/g, '')
    return join(this.directory, `${safe}.session`)
  }

  private async ensureDirectory(): Promise<void> {
    if (this.initialized) return
    await mkdir(this.directory, { recursive: true })
    this.initialized = true
  }
}
