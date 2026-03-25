import type { QueryBuilder, QueryState } from '../query/Builder.ts'
import type { SchemaBuilder } from '../schema/SchemaBuilder.ts'

export interface DatabaseConnection {
  // ── Universal execution (works on ALL drivers) ──────────────────────────
  executeSelect(state: QueryState): Promise<Record<string, any>[]>
  executeInsert(table: string, data: Record<string, any>): Promise<number>
  executeInsertGetId(table: string, data: Record<string, any>, idColumn?: string): Promise<number | string>
  executeUpdate(table: string, state: QueryState, data: Record<string, any>): Promise<number>
  executeDelete(table: string, state: QueryState): Promise<number>
  executeTruncate(table: string): Promise<void>
  executeAggregate(state: QueryState, fn: 'count' | 'sum' | 'avg' | 'min' | 'max', column: string): Promise<number>
  executeExists(state: QueryState): Promise<boolean>

  // ── Raw SQL escape hatch (throws DriverNotSupportedError on non-SQL) ───
  select(sql: string, bindings?: any[]): Promise<Record<string, any>[]>
  statement(sql: string, bindings?: any[]): Promise<number>
  insertGetId(sql: string, bindings?: any[]): Promise<number | bigint | string>

  // ── Shared ──────────────────────────────────────────────────────────────
  transaction<T>(callback: (connection: DatabaseConnection) => Promise<T>): Promise<T>
  table(name: string): QueryBuilder
  schema(): SchemaBuilder
  getDriverName(): string
  getTablePrefix(): string
}
