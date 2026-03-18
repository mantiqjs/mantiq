import { BaseGrammar } from './BaseGrammar.ts'
import type { QueryState } from '../query/Builder.ts'

export class PostgresGrammar extends BaseGrammar {
  quoteIdentifier(name: string): string {
    if (name.includes('.')) {
      return name.split('.').map((p) => `"${p}"`).join('.')
    }
    return `"${name}"`
  }

  placeholder(index: number): string {
    return `$${index}`
  }

  override compileInsertGetId(table: string, data: Record<string, any>): { sql: string; bindings: any[] } {
    const { sql, bindings } = this.compileInsert(table, data)
    return { sql: `${sql} RETURNING id`, bindings }
  }

  override compileTruncate(table: string): string {
    return `TRUNCATE TABLE ${this.quoteIdentifier(table)} RESTART IDENTITY CASCADE`
  }
}
