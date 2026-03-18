import type { QueryState } from '../query/Builder.ts'

export interface Grammar {
  /** Quote a column or table identifier */
  quoteIdentifier(name: string): string

  compileSelect(state: QueryState): { sql: string; bindings: any[] }
  compileInsert(table: string, data: Record<string, any>): { sql: string; bindings: any[] }
  compileInsertGetId(table: string, data: Record<string, any>): { sql: string; bindings: any[] }
  compileUpdate(table: string, state: QueryState, data: Record<string, any>): { sql: string; bindings: any[] }
  compileDelete(table: string, state: QueryState): { sql: string; bindings: any[] }
  compileTruncate(table: string): string

  /** Placeholder token for parameterised queries: '?' for SQLite/MySQL, '$1' for Postgres */
  placeholder(index: number): string
}
