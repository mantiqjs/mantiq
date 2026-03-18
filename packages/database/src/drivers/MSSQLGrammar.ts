import { BaseGrammar } from './BaseGrammar.ts'
import { Expression } from '../query/Expression.ts'
import type { QueryState } from '../query/Builder.ts'

export class MSSQLGrammar extends BaseGrammar {
  quoteIdentifier(name: string): string {
    if (name.includes('.')) {
      return name.split('.').map((p) => `[${p}]`).join('.')
    }
    return `[${name}]`
  }

  placeholder(index: number): string {
    return `@p${index}`
  }

  /**
   * MSSQL uses TOP for limit-only and OFFSET…FETCH for pagination.
   */
  override compileSelect(state: QueryState): { sql: string; bindings: any[] } {
    const bindings: any[] = []
    const parts: string[] = []

    // Collect raw expression bindings from columns first
    const colBindings: any[] = []
    for (const c of state.columns) {
      if (c instanceof Expression) colBindings.push(...c.bindings)
    }

    const cols = state.columns.map((c) => {
      if (c instanceof Expression) return c.value
      const s = c as string
      if (s === '*' || s.endsWith('.*')) return s
      return this.quoteIdentifier(s)
    }).join(', ')

    // TOP n when limit is set but offset is not
    const useTop = state.limitValue !== null && state.offsetValue === null
    parts.push(`SELECT ${state.distinct ? 'DISTINCT ' : ''}${useTop ? `TOP ${state.limitValue} ` : ''}${cols}`)
    parts.push(`FROM ${this.quoteIdentifier(state.table)}`)

    // JOINs
    for (const j of state.joins) {
      const type = j.type.toUpperCase()
      parts.push(`${type} JOIN ${this.quoteIdentifier(j.table)} ON ${j.first} ${j.operator} ${j.second}`)
    }

    // WHERE
    if (state.wheres.length) {
      const { sql: whereSql, bindings: wb } = this.compileWheres(state.wheres, colBindings.length + 1)
      parts.push(`WHERE ${whereSql}`)
      bindings.push(...wb)
    }

    // GROUP BY
    if (state.groups.length) {
      parts.push(`GROUP BY ${state.groups.map((g) => this.quoteIdentifier(g)).join(', ')}`)
    }

    // HAVING
    if (state.havings.length) {
      const havingStartIdx = colBindings.length + bindings.length + 1
      const { sql: havingSql, bindings: hb } = this.compileWheres(state.havings, havingStartIdx)
      parts.push(`HAVING ${havingSql}`)
      bindings.push(...hb)
    }

    // ORDER BY
    if (state.orders.length) {
      const orderStr = state.orders.map((o) => {
        const col = o.column instanceof Expression
          ? o.column.value
          : this.quoteIdentifier(o.column as string)
        return `${col} ${o.direction.toUpperCase()}`
      }).join(', ')
      parts.push(`ORDER BY ${orderStr}`)
    }

    // OFFSET…FETCH pagination (requires ORDER BY)
    if (state.offsetValue !== null) {
      if (!state.orders.length) {
        parts.push('ORDER BY (SELECT NULL)')
      }
      parts.push(`OFFSET ${state.offsetValue} ROWS`)
      if (state.limitValue !== null) {
        parts.push(`FETCH NEXT ${state.limitValue} ROWS ONLY`)
      }
    }

    return { sql: parts.join(' '), bindings: [...colBindings, ...bindings] }
  }

  override compileInsertGetId(table: string, data: Record<string, any>): { sql: string; bindings: any[] } {
    const keys = Object.keys(data)
    const cols = keys.map((k) => this.quoteIdentifier(k)).join(', ')
    const placeholders = keys.map((_, i) => this.placeholder(i + 1)).join(', ')
    return {
      sql: `INSERT INTO ${this.quoteIdentifier(table)} (${cols}) OUTPUT INSERTED.[id] VALUES (${placeholders})`,
      bindings: Object.values(data),
    }
  }

  override compileTruncate(table: string): string {
    return `TRUNCATE TABLE ${this.quoteIdentifier(table)}`
  }
}
