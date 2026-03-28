import type { DatabaseConnection } from '../contracts/Connection.ts'
import type { Grammar } from '../contracts/Grammar.ts'
import type { QueryState } from '../query/Builder.ts'
import type { SchemaBuilder } from '../schema/SchemaBuilder.ts'
import { QueryBuilder } from '../query/Builder.ts'
import { Expression } from '../query/Expression.ts'

/**
 * Known error messages that indicate the database connection has been lost.
 * When detected, the connection will automatically attempt to reconnect
 * and retry the query once before throwing.
 */
const LOST_CONNECTION_MESSAGES = [
  'server has gone away',
  'no connection to the server',
  'lost connection',
  'is dead or not enabled',
  'error while sending',
  'decryption failed or bad record mac',
  'server closed the connection unexpectedly',
  'ssl connection has been closed unexpectedly',
  'error writing data to the connection',
  'resource deadlock avoided',
  'transaction is not active',
  'connection was killed',
  'connection reset',
  'econnreset',
  'econnrefused',
  'epipe',
  'etimedout',
  'broken pipe',
  'connection timed out',
]

/**
 * Abstract base for all SQL connections. Provides `executeXxx()` methods
 * by compiling QueryState via Grammar and delegating to the raw SQL methods
 * that each driver must implement.
 */
export abstract class BaseSQLConnection implements DatabaseConnection {
  abstract readonly _grammar: Grammar

  // ── Subclasses implement these (raw SQL execution) ──────────────────────
  abstract select(sql: string, bindings?: any[]): Promise<Record<string, any>[]>
  abstract statement(sql: string, bindings?: any[]): Promise<number>
  abstract insertGetId(sql: string, bindings?: any[]): Promise<number | bigint | string>
  abstract transaction<T>(callback: (connection: DatabaseConnection) => Promise<T>): Promise<T>
  abstract schema(): SchemaBuilder
  abstract getDriverName(): string

  /**
   * Reconnect the underlying database connection.
   * Override in subclasses to close and re-establish the connection.
   */
  async reconnect(): Promise<void> {
    // Default is a no-op. Subclasses with connection pools (MySQL, Postgres, MSSQL)
    // can override to destroy and recreate the pool.
  }

  /**
   * Check if an error indicates the database connection has been lost.
   */
  protected isLostConnection(err: any): boolean {
    const message = String(err?.message ?? '').toLowerCase()
    return LOST_CONNECTION_MESSAGES.some((msg) => message.includes(msg))
  }

  /**
   * Run a callback with automatic reconnection on lost connection errors.
   * If the first attempt fails with a lost connection error, reconnects
   * and retries once.
   */
  protected async withReconnect<T>(callback: () => Promise<T>): Promise<T> {
    try {
      return await callback()
    } catch (err: any) {
      if (this.isLostConnection(err)) {
        await this.reconnect()
        return await callback()
      }
      throw err
    }
  }

  getTablePrefix(): string {
    return ''
  }

  table(name: string): QueryBuilder {
    return new QueryBuilder(this, name)
  }

  // ── Universal executeXxx (compile via Grammar → run via raw methods) ────

  async executeSelect(state: QueryState): Promise<Record<string, any>[]> {
    const { sql, bindings } = this._grammar.compileSelect(state)
    return this.select(sql, bindings)
  }

  async executeInsert(table: string, data: Record<string, any>): Promise<number> {
    const { sql, bindings } = this._grammar.compileInsert(table, data)
    return this.statement(sql, bindings)
  }

  async executeInsertGetId(table: string, data: Record<string, any>, idColumn?: string): Promise<number | string> {
    const { sql, bindings } = this._grammar.compileInsertGetId(table, data, idColumn)
    const id = await this.insertGetId(sql, bindings)
    // SQL drivers always return numeric IDs (bigint from SQLite, string from pg for BIGSERIAL)
    return Number(id)
  }

  async executeUpdate(table: string, state: QueryState, data: Record<string, any>): Promise<number> {
    const { sql, bindings } = this._grammar.compileUpdate(table, state, data)
    return this.statement(sql, bindings)
  }

  async executeDelete(table: string, state: QueryState): Promise<number> {
    const { sql, bindings } = this._grammar.compileDelete(table, state)
    return this.statement(sql, bindings)
  }

  async executeTruncate(table: string): Promise<void> {
    const sql = this._grammar.compileTruncate(table)
    await this.statement(sql, [])
  }

  async executeAggregate(state: QueryState, fn: 'count' | 'sum' | 'avg' | 'min' | 'max', column: string): Promise<number> {
    const aggState: QueryState = {
      ...state,
      columns: [new Expression(`${fn.toUpperCase()}(${column}) as aggregate`)],
      orders: [],  // aggregates don't need ORDER BY
    }
    const { sql, bindings } = this._grammar.compileSelect(aggState)
    const rows = await this.select(sql, bindings)
    return Number(rows[0]?.['aggregate'] ?? 0)
  }

  async executeExists(state: QueryState): Promise<boolean> {
    const existsState: QueryState = {
      ...state,
      columns: [new Expression('1 as exists_check')],
      limitValue: 1,
      orders: [],
    }
    const { sql, bindings } = this._grammar.compileSelect(existsState)
    const rows = await this.select(sql, bindings)
    return rows.length > 0
  }

  /**
   * Creates executeXxx methods for a transactional connection wrapper.
   * Call this in transaction() to give the txConn the universal methods.
   */
  protected applyExecuteMethods(txConn: any): void {
    txConn.executeSelect = (state: QueryState) =>
      BaseSQLConnection.prototype.executeSelect.call({ ...txConn, _grammar: this._grammar }, state)
    txConn.executeInsert = (table: string, data: Record<string, any>) =>
      BaseSQLConnection.prototype.executeInsert.call({ ...txConn, _grammar: this._grammar }, table, data)
    txConn.executeInsertGetId = (table: string, data: Record<string, any>, idColumn?: string) =>
      BaseSQLConnection.prototype.executeInsertGetId.call({ ...txConn, _grammar: this._grammar }, table, data, idColumn)
    txConn.executeUpdate = (table: string, state: QueryState, data: Record<string, any>) =>
      BaseSQLConnection.prototype.executeUpdate.call({ ...txConn, _grammar: this._grammar }, table, state, data)
    txConn.executeDelete = (table: string, state: QueryState) =>
      BaseSQLConnection.prototype.executeDelete.call({ ...txConn, _grammar: this._grammar }, table, state)
    txConn.executeTruncate = (table: string) =>
      BaseSQLConnection.prototype.executeTruncate.call({ ...txConn, _grammar: this._grammar }, table)
    txConn.executeAggregate = (state: QueryState, fn: 'count' | 'sum' | 'avg' | 'min' | 'max', column: string) =>
      BaseSQLConnection.prototype.executeAggregate.call({ ...txConn, _grammar: this._grammar }, state, fn, column)
    txConn.executeExists = (state: QueryState) =>
      BaseSQLConnection.prototype.executeExists.call({ ...txConn, _grammar: this._grammar }, state)
  }
}
