import { Expression } from '../query/Expression.ts'
import type { WhereClause, QueryState, JoinClause, OrderClause } from '../query/Builder.ts'
import type { Grammar } from '../contracts/Grammar.ts'

export abstract class BaseGrammar implements Grammar {
  abstract quoteIdentifier(name: string): string
  abstract placeholder(index: number): string

  // ── SELECT ────────────────────────────────────────────────────────────────

  compileSelect(state: QueryState): { sql: string; bindings: any[] } {
    const bindings: any[] = []
    const parts: string[] = []

    // Collect raw expression bindings from columns first (they come first in the final bindings)
    const colBindings: any[] = []
    for (const c of state.columns) {
      if (c instanceof Expression) colBindings.push(...c.bindings)
    }

    const cols = state.columns.map((c) => {
      if (c instanceof Expression) return c.value
      const s = c as string
      // Don't quote wildcards or already-qualified expressions
      if (s === '*' || s.endsWith('.*')) return s
      return this.quoteIdentifier(s)
    }).join(', ')

    parts.push(`SELECT ${state.distinct ? 'DISTINCT ' : ''}${cols}`)
    parts.push(`FROM ${this.quoteIdentifier(state.table)}`)

    if (state.joins.length) {
      for (const j of state.joins) {
        parts.push(this.compileJoin(j))
      }
    }

    if (state.wheres.length) {
      const { sql: whereSql, bindings: wb } = this.compileWheres(state.wheres, colBindings.length + 1)
      parts.push(`WHERE ${whereSql}`)
      bindings.push(...wb)
    }

    if (state.groups.length) {
      parts.push(`GROUP BY ${state.groups.map((g) => this.quoteIdentifier(g)).join(', ')}`)
    }

    if (state.havings.length) {
      const havingStartIdx = colBindings.length + bindings.length + 1
      const { sql: havingSql, bindings: hb } = this.compileWheres(state.havings, havingStartIdx)
      parts.push(`HAVING ${havingSql}`)
      bindings.push(...hb)
    }

    if (state.orders.length) {
      const orderStr = state.orders.map((o) => {
        const col = o.column instanceof Expression
          ? o.column.value
          : this.quoteIdentifier(o.column as string)
        return `${col} ${o.direction.toUpperCase()}`
      }).join(', ')
      parts.push(`ORDER BY ${orderStr}`)
    }

    if (state.limitValue !== null) {
      parts.push(`LIMIT ${state.limitValue}`)
    }

    if (state.offsetValue !== null) {
      parts.push(`OFFSET ${state.offsetValue}`)
    }

    return { sql: parts.join(' '), bindings: [...colBindings, ...bindings] }
  }

  // ── INSERT ────────────────────────────────────────────────────────────────

  compileInsert(table: string, data: Record<string, any>): { sql: string; bindings: any[] } {
    const keys = Object.keys(data)
    const cols = keys.map((k) => this.quoteIdentifier(k)).join(', ')
    const placeholders = keys.map((_, i) => this.placeholder(i + 1)).join(', ')
    return {
      sql: `INSERT INTO ${this.quoteIdentifier(table)} (${cols}) VALUES (${placeholders})`,
      bindings: Object.values(data),
    }
  }

  compileInsertGetId(table: string, data: Record<string, any>): { sql: string; bindings: any[] } {
    return this.compileInsert(table, data)
  }

  // ── UPDATE ────────────────────────────────────────────────────────────────

  compileUpdate(
    table: string,
    state: QueryState,
    data: Record<string, any>,
  ): { sql: string; bindings: any[] } {
    const bindings: any[] = []
    const keys = Object.keys(data)
    let setIndex = 1
    const sets = keys.map((k) => {
      const val = data[k]
      if (val instanceof Expression) return `${this.quoteIdentifier(k)} = ${val.value}`
      bindings.push(val)
      return `${this.quoteIdentifier(k)} = ${this.placeholder(setIndex++)}`
    }).join(', ')

    let sql = `UPDATE ${this.quoteIdentifier(table)} SET ${sets}`

    if (state.wheres.length) {
      // Pass current binding count so WHERE $n continues from where SET left off
      const { sql: whereSql, bindings: wb } = this.compileWheres(state.wheres, bindings.length + 1)
      sql += ` WHERE ${whereSql}`
      bindings.push(...wb)
    }

    return { sql, bindings }
  }

  // ── DELETE ────────────────────────────────────────────────────────────────

  compileDelete(table: string, state: QueryState): { sql: string; bindings: any[] } {
    const bindings: any[] = []
    let sql = `DELETE FROM ${this.quoteIdentifier(table)}`

    if (state.wheres.length) {
      const { sql: whereSql, bindings: wb } = this.compileWheres(state.wheres)
      sql += ` WHERE ${whereSql}`
      bindings.push(...wb)
    }

    return { sql, bindings }
  }

  compileTruncate(table: string): string {
    return `DELETE FROM ${this.quoteIdentifier(table)}`
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private compileJoin(j: JoinClause): string {
    const type = j.type.toUpperCase()
    return `${type} JOIN ${this.quoteIdentifier(j.table)} ON ${j.first} ${j.operator} ${j.second}`
  }

  protected compileWheres(wheres: WhereClause[], startIndex = 1): { sql: string; bindings: any[] } {
    const parts: string[] = []
    const bindings: any[] = []
    let bindingIndex = startIndex

    for (let i = 0; i < wheres.length; i++) {
      const w = wheres[i]!
      const bool = i === 0 ? '' : w.boolean.toUpperCase() + ' '

      if (w.type === 'raw') {
        parts.push(`${bool}${w.sql}`)
        const rawBindings = w.bindings ?? []
        bindings.push(...rawBindings)
        bindingIndex += rawBindings.length
        continue
      }

      if (w.type === 'nested') {
        const { sql: nestedSql, bindings: nb } = this.compileWheres(w.nested ?? [], bindingIndex)
        parts.push(`${bool}(${nestedSql})`)
        bindings.push(...nb)
        bindingIndex += nb.length
        continue
      }

      if (w.type === 'null') {
        parts.push(`${bool}${this.quoteIdentifier(w.column!)} IS NULL`)
        continue
      }

      if (w.type === 'notNull') {
        parts.push(`${bool}${this.quoteIdentifier(w.column!)} IS NOT NULL`)
        continue
      }

      if (w.type === 'in') {
        const placeholders = (w.values ?? []).map((_, i) => this.placeholder(bindingIndex++)).join(', ')
        parts.push(`${bool}${this.quoteIdentifier(w.column!)} IN (${placeholders})`)
        bindings.push(...(w.values ?? []))
        continue
      }

      if (w.type === 'notIn') {
        const placeholders = (w.values ?? []).map((_, i) => this.placeholder(bindingIndex++)).join(', ')
        parts.push(`${bool}${this.quoteIdentifier(w.column!)} NOT IN (${placeholders})`)
        bindings.push(...(w.values ?? []))
        continue
      }

      if (w.type === 'between') {
        const p1 = this.placeholder(bindingIndex++)
        const p2 = this.placeholder(bindingIndex++)
        parts.push(`${bool}${this.quoteIdentifier(w.column!)} BETWEEN ${p1} AND ${p2}`)
        bindings.push(...(w.range ?? []))
        continue
      }

      // basic
      if (w.value instanceof Expression) {
        parts.push(`${bool}${this.quoteIdentifier(w.column!)} ${w.operator} ${w.value.value}`)
      } else {
        parts.push(`${bool}${this.quoteIdentifier(w.column!)} ${w.operator} ${this.placeholder(bindingIndex++)}`)
        bindings.push(w.value)
      }
    }

    return { sql: parts.join(' '), bindings }
  }
}
