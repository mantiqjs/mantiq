import { HealthCheck } from '../HealthCheck.ts'

/**
 * Verifies the database connection is alive by running a simple query.
 *
 * @example
 * health.register(new DatabaseCheck(db().connection()))
 */
export class DatabaseCheck extends HealthCheck {
  readonly name = 'database'

  constructor(private connection: any) {
    super()
  }

  override async run(): Promise<void> {
    const driver = this.connection.getDriverName?.() ?? 'unknown'
    this.meta('driver', driver)

    const start = performance.now()

    if (driver === 'mongodb') {
      // MongoDB: ping the server
      const db = typeof this.connection.native === 'function'
        ? await this.connection.native()
        : null
      if (db) {
        await db.command({ ping: 1 })
      } else {
        throw new Error('Cannot access native MongoDB connection')
      }
    } else {
      // SQL: run a trivial query
      await this.connection.select('SELECT 1')
    }

    this.meta('latency', `${Math.round(performance.now() - start)}ms`)
  }
}
