import type { DatabaseConnection } from '../contracts/Connection.ts'
import type { SchemaBuilder } from '../schema/SchemaBuilder.ts'
import { QueryBuilder } from '../query/Builder.ts'
import { SQLiteGrammar } from './SQLiteGrammar.ts'
import { SchemaBuilderImpl } from '../schema/SchemaBuilder.ts'
import { ConnectionError } from '../errors/ConnectionError.ts'
import { QueryError } from '../errors/QueryError.ts'

export interface SQLiteConfig {
  database: string  // ':memory:' or file path
}

export class SQLiteConnection implements DatabaseConnection {
  readonly _grammar = new SQLiteGrammar()
  private db: import('bun:sqlite').Database | null = null
  private config: SQLiteConfig

  constructor(config: SQLiteConfig) {
    this.config = config
  }

  private getDb(): import('bun:sqlite').Database {
    if (!this.db) {
      try {
        const { Database } = require('bun:sqlite') as typeof import('bun:sqlite')
        this.db = new Database(this.config.database, { create: true })
        this.db.run('PRAGMA journal_mode = WAL')
        this.db.run('PRAGMA foreign_keys = ON')
      } catch (e: any) {
        throw new ConnectionError(`SQLite connection failed: ${e.message}`, 'sqlite', e)
      }
    }
    return this.db
  }

  /** bun:sqlite only accepts string | number | bigint | boolean | Uint8Array | null */
  private sanitizeBindings(bindings: any[]): any[] {
    return bindings.map((v) => {
      if (v instanceof Date) return v.toISOString()
      return v
    })
  }

  async select(sql: string, bindings: any[] = []): Promise<Record<string, any>[]> {
    try {
      const stmt = this.getDb().prepare(sql)
      return stmt.all(...this.sanitizeBindings(bindings)) as Record<string, any>[]
    } catch (e: any) {
      throw new QueryError(sql, bindings, e)
    }
  }

  async statement(sql: string, bindings: any[] = []): Promise<number> {
    try {
      const stmt = this.getDb().prepare(sql)
      const result = stmt.run(...this.sanitizeBindings(bindings))
      return result.changes
    } catch (e: any) {
      throw new QueryError(sql, bindings, e)
    }
  }

  async insertGetId(sql: string, bindings: any[] = []): Promise<number | bigint> {
    try {
      const stmt = this.getDb().prepare(sql)
      const result = stmt.run(...this.sanitizeBindings(bindings))
      return result.lastInsertRowid
    } catch (e: any) {
      throw new QueryError(sql, bindings, e)
    }
  }

  async transaction<T>(callback: (connection: DatabaseConnection) => Promise<T>): Promise<T> {
    const db = this.getDb()
    db.run('BEGIN')
    try {
      const result = await callback(this)
      db.run('COMMIT')
      return result
    } catch (e) {
      db.run('ROLLBACK')
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
    return 'sqlite'
  }

  getTablePrefix(): string {
    return ''
  }

  close(): void {
    this.db?.close()
    this.db = null
  }
}
