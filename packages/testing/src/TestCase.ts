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

  /** Whether to wrap each test in a database transaction that is rolled back after. */
  usesDatabaseTransactions = false

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
      if (this.usesDatabaseTransactions) {
        await this.beginDatabaseTransaction()
      }
    })

    afterEach(async () => {
      if (this.usesDatabaseTransactions) {
        await this.rollbackDatabaseTransaction()
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
      // Provide a minimal mock server so kernel.handle() can call server.requestIP()
      const mockServer = { requestIP: () => null } as any
      this.handler = (req: Request) => kernel.handle(req, mockServer)
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

  /** Assert a soft-deleted row exists. */
  async assertSoftDeleted(table: string, data: Record<string, any>, column = 'deleted_at'): Promise<void> {
    const conn = await this.getConnection()
    let query = conn.table(table)
    for (const [key, value] of Object.entries(data)) query = query.where(key, value)
    query = query.whereNotNull(column)
    const row = await query.first()
    expect(row).not.toBeNull()
  }

  /** Assert a row is NOT soft-deleted. */
  async assertNotSoftDeleted(table: string, data: Record<string, any>, column = 'deleted_at'): Promise<void> {
    const conn = await this.getConnection()
    let query = conn.table(table)
    for (const [key, value] of Object.entries(data)) query = query.where(key, value)
    query = query.whereNull(column)
    const row = await query.first()
    expect(row).not.toBeNull()
  }

  /** Assert a model instance exists in the database. */
  async assertModelExists(model: any): Promise<void> {
    const table = model.constructor.table || model.constructor.name.toLowerCase() + 's'
    const pk = model.constructor.primaryKey || 'id'
    await this.assertDatabaseHas(table, { [pk]: model.getKey() })
  }

  /** Assert a model instance does NOT exist in the database. */
  async assertModelMissing(model: any): Promise<void> {
    const table = model.constructor.table || model.constructor.name.toLowerCase() + 's'
    const pk = model.constructor.primaryKey || 'id'
    await this.assertDatabaseMissing(table, { [pk]: model.getKey() })
  }

  // ── Auth helpers ──────────────────────────────────────────────────────

  /**
   * Authenticate as the given user for subsequent requests.
   * Token auth: creates a bearer token. Session auth: logs in via POST.
   */
  async actingAs(user: any, guard = 'web'): Promise<this> {
    if (guard === 'api' || guard === 'token') {
      if (typeof user.createToken === 'function') {
        const { plainTextToken } = await user.createToken('testing')
        this.client.withToken(plainTextToken)
      }
    } else {
      // Session auth — POST to login endpoint with user credentials
      await this.client.initSession()
      // If user has email + known password, POST login
      // Otherwise, directly set the auth via the container
      if (user.email && user._testPassword) {
        await this.client.post('/login', { email: user.email, password: user._testPassword })
      }
    }
    return this
  }

  /** Assert that a user is authenticated. */
  async assertAuthenticated(guard = 'web'): Promise<void> {
    if (guard === 'api' || guard === 'token') {
      // Check that the client has a token set
      const res = await this.client.get('/api/user')
      expect(res.status).not.toBe(401)
    } else {
      // Check that a protected route is accessible
      const res = await this.client.get('/dashboard')
      expect(res.status).not.toBe(401)
      expect(res.status).not.toBe(302)
    }
  }

  /** Assert that no user is authenticated (guest). */
  async assertGuest(guard = 'web'): Promise<void> {
    if (guard === 'api' || guard === 'token') {
      const res = await this.client.get('/api/user')
      expect(res.status).toBeGreaterThanOrEqual(400)
    } else {
      const res = await this.client.get('/dashboard')
      expect([401, 302, 403]).toContain(res.status)
    }
  }

  // ── Lifecycle helpers ─────────────────────────────────────────────────

  /** Disable specific middleware for subsequent requests. */
  withoutMiddleware(...middleware: string[]): this {
    // Store middleware to skip — the kernel will check this
    this._disabledMiddleware = middleware
    return this
  }

  /** Let exceptions throw instead of returning error responses. */
  withoutExceptionHandling(): this {
    this._withoutExceptionHandling = true
    return this
  }

  /** Re-enable exception handling. */
  withExceptionHandling(): this {
    this._withoutExceptionHandling = false
    return this
  }

  // ── Database transaction helpers ──────────────────────────────────────

  /**
   * Begin a database transaction. The transaction will be rolled back
   * in afterEach, so test data never persists.
   */
  private async beginDatabaseTransaction(): Promise<void> {
    const conn = await this.getConnection()

    // We start a transaction that stays open for the duration of the test.
    // The transaction callback resolves only when we signal rollback.
    this._txPromise = conn.transaction(async (txConn) => {
      // Replace the connection used by getConnection() with the transactional one
      this._connection = txConn

      // Wait until the test completes and rollback is signalled
      await new Promise<void>((resolve) => {
        this._txResolve = resolve
      })

      // Throw to force rollback instead of commit
      throw new TransactionRollbackError()
    }).catch((err) => {
      // Swallow the intentional rollback error
      if (!(err instanceof TransactionRollbackError)) throw err
    })
  }

  /**
   * Roll back the database transaction started in beforeEach.
   */
  private async rollbackDatabaseTransaction(): Promise<void> {
    if (this._txResolve) {
      // Signal the transaction callback to finish (which triggers rollback)
      this._txResolve()
      this._txResolve = null
    }
    if (this._txPromise) {
      await this._txPromise
      this._txPromise = null
    }
    // Reset connection so next test gets a fresh one
    this._connection = null
  }

  private _disabledMiddleware: string[] = []
  private _withoutExceptionHandling = false

  /** Resolve/reject pair for the current transaction rollback. */
  private _txResolve: (() => void) | null = null
  private _txPromise: Promise<void> | null = null
}

/**
 * Sentinel error thrown inside the transaction callback to force a rollback
 * instead of a commit. Caught and swallowed by beginDatabaseTransaction().
 */
class TransactionRollbackError extends Error {
  constructor() {
    super('Transaction rolled back by test harness')
    this.name = 'TransactionRollbackError'
  }
}
