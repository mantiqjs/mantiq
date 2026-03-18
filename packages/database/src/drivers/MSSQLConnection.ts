import type { DatabaseConnection } from '../contracts/Connection.ts'
import type { SchemaBuilder } from '../schema/SchemaBuilder.ts'
import { QueryBuilder } from '../query/Builder.ts'
import { MSSQLGrammar } from './MSSQLGrammar.ts'
import { SchemaBuilderImpl } from '../schema/SchemaBuilder.ts'
import { ConnectionError } from '../errors/ConnectionError.ts'
import { QueryError } from '../errors/QueryError.ts'

export interface MSSQLConfig {
  host?: string
  port?: number
  database: string
  user?: string
  password?: string
  encrypt?: boolean
  trustServerCertificate?: boolean
  pool?: { min?: number; max?: number }
}

export class MSSQLConnection implements DatabaseConnection {
  readonly _grammar = new MSSQLGrammar()
  private pool: any = null
  private config: MSSQLConfig

  constructor(config: MSSQLConfig) {
    this.config = config
  }

  private async getPool(): Promise<any> {
    if (!this.pool) {
      try {
        const mssql = await import('mssql')
        const sql = mssql.default ?? mssql
        this.pool = await sql.connect({
          server: this.config.host ?? 'localhost',
          port: this.config.port ?? 1433,
          database: this.config.database,
          user: this.config.user,
          password: this.config.password,
          options: {
            encrypt: this.config.encrypt ?? false,
            trustServerCertificate: this.config.trustServerCertificate ?? true,
          },
          pool: {
            min: this.config.pool?.min ?? 2,
            max: this.config.pool?.max ?? 10,
          },
        })
      } catch (e: any) {
        throw new ConnectionError(`MSSQL connection failed: ${e.message}`, 'mssql', e)
      }
    }
    return this.pool
  }

  private addInputs(request: any, bindings: any[]): any {
    bindings.forEach((val, i) => {
      request.input(`p${i + 1}`, val)
    })
    return request
  }

  async select(sql: string, bindings: any[] = []): Promise<Record<string, any>[]> {
    const pool = await this.getPool()
    try {
      const request = this.addInputs(pool.request(), bindings)
      const result = await request.query(sql)
      return result.recordset ?? []
    } catch (e: any) {
      throw new QueryError(sql, bindings, e)
    }
  }

  async statement(sql: string, bindings: any[] = []): Promise<number> {
    const pool = await this.getPool()
    try {
      const request = this.addInputs(pool.request(), bindings)
      const result = await request.query(sql)
      return result.rowsAffected?.[0] ?? 0
    } catch (e: any) {
      throw new QueryError(sql, bindings, e)
    }
  }

  async insertGetId(sql: string, bindings: any[] = []): Promise<number | bigint> {
    const pool = await this.getPool()
    try {
      const request = this.addInputs(pool.request(), bindings)
      const result = await request.query(sql)
      return result.recordset?.[0]?.id ?? 0
    } catch (e: any) {
      throw new QueryError(sql, bindings, e)
    }
  }

  async transaction<T>(callback: (connection: DatabaseConnection) => Promise<T>): Promise<T> {
    const pool = await this.getPool()
    const mssql = await import('mssql')
    const sql = mssql.default ?? mssql
    const transaction = new sql.Transaction(pool)
    await transaction.begin()
    try {
      const txConn: DatabaseConnection = {
        select: async (s, b = []) => {
          const req = transaction.request()
          b.forEach((val: any, i: number) => req.input(`p${i + 1}`, val))
          const r = await req.query(s)
          return r.recordset ?? []
        },
        statement: async (s, b = []) => {
          const req = transaction.request()
          b.forEach((val: any, i: number) => req.input(`p${i + 1}`, val))
          const r = await req.query(s)
          return r.rowsAffected?.[0] ?? 0
        },
        insertGetId: async (s, b = []) => {
          const req = transaction.request()
          b.forEach((val: any, i: number) => req.input(`p${i + 1}`, val))
          const r = await req.query(s)
          return r.recordset?.[0]?.id ?? 0
        },
        transaction: (cb) => cb(txConn),
        table: (name) => new QueryBuilder(txConn, name),
        schema: () => new SchemaBuilderImpl(txConn),
        getDriverName: () => 'mssql',
        getTablePrefix: () => '',
      }
      // @ts-ignore — attach grammar
      txConn._grammar = this._grammar
      const result = await callback(txConn)
      await transaction.commit()
      return result
    } catch (e) {
      await transaction.rollback()
      throw e
    }
  }

  table(name: string): QueryBuilder {
    return new QueryBuilder(this, name)
  }

  schema(): SchemaBuilder {
    return new SchemaBuilderImpl(this)
  }

  getDriverName(): string {
    return 'mssql'
  }

  getTablePrefix(): string {
    return ''
  }
}
