import { BaseGrammar } from './BaseGrammar.ts'
import type { QueryState } from '../query/Builder.ts'

export class MySQLGrammar extends BaseGrammar {
  quoteIdentifier(name: string): string {
    if (name.includes('.')) {
      return name.split('.').map((p) => `\`${p}\``).join('.')
    }
    return `\`${name}\``
  }

  placeholder(_index: number): string {
    return '?'
  }

  override compileTruncate(table: string): string {
    return `TRUNCATE TABLE ${this.quoteIdentifier(table)}`
  }
}
