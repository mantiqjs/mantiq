import type { QueryBuilder } from '../query/Builder.ts'
import type { SchemaBuilder } from '../schema/SchemaBuilder.ts'

export interface DatabaseConnection {
  select(sql: string, bindings?: any[]): Promise<Record<string, any>[]>
  statement(sql: string, bindings?: any[]): Promise<number>
  insertGetId(sql: string, bindings?: any[]): Promise<number | bigint>
  transaction<T>(callback: (connection: DatabaseConnection) => Promise<T>): Promise<T>
  table(name: string): QueryBuilder
  schema(): SchemaBuilder
  getDriverName(): string
  getTablePrefix(): string
}
