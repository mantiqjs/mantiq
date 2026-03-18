import { BaseGrammar } from './BaseGrammar.ts'

export class SQLiteGrammar extends BaseGrammar {
  quoteIdentifier(name: string): string {
    // Handle table.column notation
    if (name.includes('.')) {
      return name.split('.').map((p) => `"${p}"`).join('.')
    }
    return `"${name}"`
  }

  placeholder(_index: number): string {
    return '?'
  }

  override compileTruncate(table: string): string {
    return `DELETE FROM ${this.quoteIdentifier(table)}`
  }
}
