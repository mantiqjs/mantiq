import type { DatabaseConnection } from '../contracts/Connection.ts'
import type { SchemaBuilder } from '../schema/SchemaBuilder.ts'
import type { EventDispatcher } from '@mantiq/core'
import { QueryBuilder } from '../query/Builder.ts'
import { SQLiteGrammar } from './SQLiteGrammar.ts'
import { SchemaBuilderImpl } from '../schema/SchemaBuilder.ts'
import { ConnectionError } from '../errors/ConnectionError.ts'
import { QueryError } from '../errors/QueryError.ts'
import { QueryExecuted, TransactionBeginning, TransactionCommitted, TransactionRolledBack } from '../events/DatabaseEvents.ts'

export interface SQLiteConfig {
  database: string  // ':memory:' or file path
}

export class SQLiteConnection implements DatabaseConnection {
  readonly _grammar = new SQLiteGrammar()
  private db: import('bun:sqlite').Database | null = null
  private config: SQLiteConfig

  /** Optional event dispatcher. Set by @mantiq/events when installed. */
  static _dispatcher: EventDispatcher | null = null

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
      const start = performance.now()
      const stmt = this.getDb().prepare(sql)
      const result = stmt.all(...this.sanitizeBindings(bindings)) as Record<string, any>[]
      await this.fireQueryEvent(sql, bindings, performance.now() - start)
      return result
    } catch (e: any) {
      throw new QueryError(sql, bindings, e)
    }
  }

  async statement(sql: string, bindings: any[] = []): Promise<number> {
    try {
      const start = performance.now()
      const stmt = this.getDb().prepare(sql)
      const result = stmt.run(...this.sanitizeBindings(bindings))
      await this.fireQueryEvent(sql, bindings, performance.now() - start)
      return result.changes
    } catch (e: any) {
      throw new QueryError(sql, bindings, e)
    }
  }

  async insertGetId(sql: string, bindings: any[] = []): Promise<number | bigint> {
    try {
      const start = performance.now()
      const stmt = this.getDb().prepare(sql)
      const result = stmt.run(...this.sanitizeBindings(bindings))
      await this.fireQueryEvent(sql, bindings, performance.now() - start)
      return result.lastInsertRowid
    } catch (e: any) {
      throw new QueryError(sql, bindings, e)
    }
  }

  async transaction<T>(callback: (connection: DatabaseConnection) => Promise<T>): Promise<T> {
    const db = this.getDb()
    db.run('BEGIN')
    await SQLiteConnection._dispatcher?.emit(new TransactionBeginning('sqlite'))
    try {
      const result = await callback(this)
      db.run('COMMIT')
      await SQLiteConnection._dispatcher?.emit(new TransactionCommitted('sqlite'))
      return result
    } catch (e) {
      db.run('ROLLBACK')
      await SQLiteConnection._dispatcher?.emit(new TransactionRolledBack('sqlite'))
      throw e
    }
  }

  private async fireQueryEvent(sql: string, bindings: any[], time: number): Promise<void> {
    await SQLiteConnection._dispatcher?.emit(new QueryExecuted(sql, bindings, time, 'sqlite'))
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
