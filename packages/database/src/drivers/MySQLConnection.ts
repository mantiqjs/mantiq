import type { DatabaseConnection } from '../contracts/Connection.ts'
import type { SchemaBuilder } from '../schema/SchemaBuilder.ts'
import { BaseSQLConnection } from './BaseSQLConnection.ts'
import { QueryBuilder } from '../query/Builder.ts'
import { MySQLGrammar } from './MySQLGrammar.ts'
import { SchemaBuilderImpl } from '../schema/SchemaBuilder.ts'
import { ConnectionError } from '../errors/ConnectionError.ts'
import { QueryError } from '../errors/QueryError.ts'

export interface MySQLConfig {
  host?: string
  port?: number
  database: string
  user?: string
  password?: string
  pool?: { min?: number; max?: number }
}

export class MySQLConnection extends BaseSQLConnection {
  readonly _grammar = new MySQLGrammar()
  private pool: any = null
  private config: MySQLConfig

  constructor(config: MySQLConfig) {
    super()
    this.config = config
  }

  private async getPool(): Promise<any> {
    if (!this.pool) {
      try {
        const mysql = await import('mysql2/promise')
        this.pool = await mysql.createPool({
          host: this.config.host ?? 'localhost',
          port: this.config.port ?? 3306,
          database: this.config.database,
          user: this.config.user,
          password: this.config.password,
          connectionLimit: this.config.pool?.max ?? 10,
          waitForConnections: true,
        })
      } catch (e: any) {
        throw new ConnectionError(`MySQL connection failed: ${e.message}`, 'mysql', e)
      }
    }
    return this.pool
  }

  async select(sql: string, bindings: any[] = []): Promise<Record<string, any>[]> {
    const pool = await this.getPool()
    try {
      const [rows] = await pool.query(sql, bindings)
      return rows as Record<string, any>[]
    } catch (e: any) {
      throw new QueryError(sql, bindings, e)
    }
  }

  async statement(sql: string, bindings: any[] = []): Promise<number> {
    const pool = await this.getPool()
    try {
      const [result] = await pool.query(sql, bindings)
      return (result as any).affectedRows ?? 0
    } catch (e: any) {
      throw new QueryError(sql, bindings, e)
    }
  }

  async insertGetId(sql: string, bindings: any[] = []): Promise<number | bigint> {
    const pool = await this.getPool()
    try {
      const [result] = await pool.query(sql, bindings)
      return (result as any).insertId ?? 0
    } catch (e: any) {
      throw new QueryError(sql, bindings, e)
    }
  }

  async transaction<T>(callback: (connection: DatabaseConnection) => Promise<T>): Promise<T> {
    const pool = await this.getPool()
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      const txConn: any = {
        _grammar: this._grammar,
        select: async (sql: string, b?: any[]) => { const [rows] = await conn.query(sql, b); return rows as Record<string, any>[] },
        statement: async (sql: string, b?: any[]) => { const [r] = await conn.query(sql, b); return (r as any).affectedRows ?? 0 },
        insertGetId: async (sql: string, b?: any[]) => { const [r] = await conn.query(sql, b); return (r as any).insertId ?? 0 },
        transaction: (cb: any) => cb(txConn),
        table: (name: string) => new QueryBuilder(txConn, name),
        schema: () => new SchemaBuilderImpl(txConn),
        getDriverName: () => 'mysql',
        getTablePrefix: () => '',
      }
      this.applyExecuteMethods(txConn)
      const result = await callback(txConn)
      await conn.commit()
      return result
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
  }

  schema(): SchemaBuilder {
    return new SchemaBuilderImpl(this)
  }

  getDriverName(): string {
    return 'mysql'
  }
}
