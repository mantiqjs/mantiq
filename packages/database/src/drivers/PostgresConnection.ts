import type { DatabaseConnection } from '../contracts/Connection.ts'
import type { SchemaBuilder } from '../schema/SchemaBuilder.ts'
import { BaseSQLConnection } from './BaseSQLConnection.ts'
import { QueryBuilder } from '../query/Builder.ts'
import { PostgresGrammar } from './PostgresGrammar.ts'
import { SchemaBuilderImpl } from '../schema/SchemaBuilder.ts'
import { ConnectionError } from '../errors/ConnectionError.ts'
import { QueryError } from '../errors/QueryError.ts'

export interface PostgresConfig {
  host?: string | undefined
  port?: number | undefined
  database: string
  user?: string | undefined
  password?: string | undefined
  ssl?: boolean | undefined
  pool?: { min?: number | undefined; max?: number | undefined } | undefined
}

export class PostgresConnection extends BaseSQLConnection {
  readonly _grammar = new PostgresGrammar()
  private client: any = null
  private config: PostgresConfig

  constructor(config: PostgresConfig) {
    super()
    this.config = config
  }

  private async getClient(): Promise<any> {
    if (!this.client) {
      try {
        // Uses pg (node-postgres) compatible driver
        // @ts-ignore — optional peer dependency, may not be installed
        const { default: pg } = await import('pg')
        const pool = new pg.Pool({
          host: this.config.host ?? 'localhost',
          port: this.config.port ?? 5432,
          database: this.config.database,
          user: this.config.user,
          password: this.config.password,
          ssl: this.config.ssl ? { rejectUnauthorized: false } : false,
          min: this.config.pool?.min ?? 2,
          max: this.config.pool?.max ?? 10,
        })
        this.client = pool
      } catch (e: any) {
        throw new ConnectionError(`Postgres connection failed: ${e.message}`, 'postgres', e)
      }
    }
    return this.client
  }

  override async reconnect(): Promise<void> {
    if (this.client) {
      try { await this.client.end() } catch { /* best-effort */ }
      this.client = null
    }
  }

  async select(sql: string, bindings: any[] = []): Promise<Record<string, any>[]> {
    return this.withReconnect(async () => {
      const pool = await this.getClient()
      try {
        const result = await pool.query(sql, bindings)
        return result.rows
      } catch (e: any) {
        if (this.isLostConnection(e)) throw e
        throw new QueryError(sql, bindings, e)
      }
    })
  }

  async statement(sql: string, bindings: any[] = []): Promise<number> {
    return this.withReconnect(async () => {
      const pool = await this.getClient()
      try {
        const result = await pool.query(sql, bindings)
        return result.rowCount ?? 0
      } catch (e: any) {
        if (this.isLostConnection(e)) throw e
        throw new QueryError(sql, bindings, e)
      }
    })
  }

  async insertGetId(sql: string, bindings: any[] = []): Promise<number | bigint> {
    return this.withReconnect(async () => {
      const pool = await this.getClient()
      try {
        const result = await pool.query(sql, bindings)
        const row = result.rows[0]
        if (!row) return 0
        const keys = Object.keys(row)
        return keys.length > 0 ? row[keys[0]!] ?? 0 : 0
      } catch (e: any) {
        if (this.isLostConnection(e)) throw e
        throw new QueryError(sql, bindings, e)
      }
    })
  }

  async transaction<T>(callback: (connection: DatabaseConnection) => Promise<T>): Promise<T> {
    const pool = await this.getClient()
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const txConn: any = {
        _grammar: this._grammar,
        select: async (sql: string, b?: any[]) => { const r = await client.query(sql, b); return r.rows },
        statement: async (sql: string, b?: any[]) => { const r = await client.query(sql, b); return r.rowCount ?? 0 },
        insertGetId: async (sql: string, b?: any[]) => {
          const r = await client.query(sql, b)
          const row = r.rows[0]
          if (!row) return 0
          const keys = Object.keys(row)
          return keys.length > 0 ? row[keys[0]!] ?? 0 : 0
        },
        transaction: (cb: any) => cb(txConn),
        table: (name: string) => new QueryBuilder(txConn, name),
        schema: () => new SchemaBuilderImpl(txConn),
        getDriverName: () => 'postgres',
        getTablePrefix: () => '',
      }
      this.applyExecuteMethods(txConn)
      const result = await callback(txConn)
      await client.query('COMMIT')
      return result
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  }

  schema(): SchemaBuilder {
    return new SchemaBuilderImpl(this)
  }

  getDriverName(): string {
    return 'postgres'
  }
}
