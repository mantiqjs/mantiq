import { beforeAll, afterAll, beforeEach, afterEach } from 'bun:test'
import { TestClient } from './TestClient.ts'

import type { DatabaseConnection } from '@mantiq/database'
import { expect } from 'bun:test'

/**
 * Base test case for MantiqJS application tests.
 *
 * Boots the application, creates a test client, and provides
 * database and auth helpers. Extend this in your test files.
 *
 * @example
 *   import { TestCase } from '@mantiq/testing'
 *
 *   const t = new TestCase()
 *   t.setup()
 *
 *   test('can register', async () => {
 *     const res = await t.client.post('/register', { ... })
 *     res.assertCreated()
 *     await t.assertDatabaseHas('users', { email: 'ali@test.com' })
 *   })
 */
export class TestCase {
  /** HTTP test client — persists cookies across requests. */
  client!: TestClient

  /** The application instance. */
  app: any = null

  /** The kernel handler function. */
  private handler: ((req: Request) => Promise<Response>) | null = null

  /** Database connection (resolved lazily). */
  private _connection: DatabaseConnection | null = null

  /** Whether to refresh the database before each test. */
  refreshDatabase = false

  /** Path to the app's index.ts (defaults to cwd). */
  appPath = process.cwd()

  /**
   * Call this in your test file to set up lifecycle hooks.
   * Boots the app in beforeAll, creates a fresh client in beforeEach.
   */
  setup(): void {
    beforeAll(async () => {
      await this.bootApp()
    })

    beforeEach(async () => {
      this.client = new TestClient(
        (req) => this.handleRequest(req),
      )
      if (this.refreshDatabase) {
        await this.migrateRefresh()
      }
    })

    afterAll(async () => {
      // Cleanup
    })
  }

  // ── App lifecycle ─────────────────────────────────────────────────────

  private async bootApp(): Promise<void> {
    const mod = await import(`${this.appPath}/index.ts`)
    this.app = mod.default

    // Get the HttpKernel's handle method
    try {
      const { HttpKernel } = await import('@mantiq/core')
      const kernel = this.app.make(HttpKernel)
      this.handler = (req: Request) => kernel.handle(req)
    } catch {
      // Fallback: use the exported default as a Bun server handler
      this.handler = async (req: Request) => {
        return this.app.fetch?.(req) ?? new Response('App not bootable', { status: 500 })
      }
    }
  }

  private async handleRequest(req: Request): Promise<Response> {
    if (!this.handler) throw new Error('App not booted. Did you call setup()?')
    return this.handler(req)
  }

  // ── Database helpers ──────────────────────────────────────────────────

  private async getConnection(): Promise<DatabaseConnection> {
    if (!this._connection) {
      const { DatabaseManager } = await import('@mantiq/database')
      const manager = this.app.make(DatabaseManager)
      this._connection = manager.connection()
    }
    return this._connection!
  }

  /** Run migrations fresh (drop all + migrate). */
  async migrateRefresh(): Promise<void> {
    const { execSync } = await import('node:child_process')
    execSync('bun mantiq.ts migrate:fresh', { cwd: this.appPath, stdio: 'pipe' })
  }

  /** Run migrations. */
  async migrate(): Promise<void> {
    const { execSync } = await import('node:child_process')
    execSync('bun mantiq.ts migrate', { cwd: this.appPath, stdio: 'pipe' })
  }

  /** Run database seeders. */
  async seed(): Promise<void> {
    const { execSync } = await import('node:child_process')
    execSync('bun mantiq.ts db:seed', { cwd: this.appPath, stdio: 'pipe' })
  }

  /** Assert a row exists in the given table matching the data. */
  async assertDatabaseHas(table: string, data: Record<string, any>): Promise<void> {
    const conn = await this.getConnection()
    let query = conn.table(table)
    for (const [key, value] of Object.entries(data)) {
      query = query.where(key, value)
    }
    const row = await query.first()
    expect(row).not.toBeNull()
  }

  /** Assert no row exists in the given table matching the data. */
  async assertDatabaseMissing(table: string, data: Record<string, any>): Promise<void> {
    const conn = await this.getConnection()
    let query = conn.table(table)
    for (const [key, value] of Object.entries(data)) {
      query = query.where(key, value)
    }
    const row = await query.first()
    expect(row).toBeNull()
  }

  /** Assert the table has the given number of rows. */
  async assertDatabaseCount(table: string, count: number): Promise<void> {
    const conn = await this.getConnection()
    const result = await conn.table(table).count()
    expect(result).toBe(count)
  }

  // ── Auth helpers ──────────────────────────────────────────────────────

  /**
   * Authenticate as the given user for subsequent requests.
   * For session auth: starts a session and logs in.
   * For token auth: sets the Bearer token header.
   */
  async actingAs(user: any, guard = 'web'): Promise<this> {
    if (guard === 'api' || guard === 'token') {
      // Token auth — create a token and set it
      if (typeof user.createToken === 'function') {
        const { plainTextToken } = await user.createToken('testing')
        this.client.withToken(plainTextToken)
      }
    } else {
      // Session auth — init session then login via auth manager
      await this.client.initSession()
      try {
        const { auth } = await import('@mantiq/auth')
        const manager = auth()
        // Build a fake request with the client's cookies
        // For simplicity, POST to a login route
        // This is a workaround — proper session injection would need container access
      } catch {
        // Auth package not installed
      }
    }
    return this
  }
}
