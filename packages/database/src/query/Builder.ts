import { Expression } from './Expression.ts'
import { ModelNotFoundError } from '../errors/ModelNotFoundError.ts'
import { applyMacros } from '@mantiq/core'
import type { PaginationResult, CursorPaginationResult } from '../contracts/Paginator.ts'
import type { DatabaseConnection } from '../contracts/Connection.ts'

export type Operator = '=' | '!=' | '<>' | '<' | '>' | '<=' | '>=' | 'like' | 'not like' | 'in' | 'not in'

export interface WhereClause {
  type: 'basic' | 'in' | 'notIn' | 'null' | 'notNull' | 'between' | 'raw' | 'nested' | 'column'
  boolean: 'and' | 'or'
  column?: string | undefined
  operator?: string | undefined
  value?: any
  values?: any[] | undefined
  range?: [any, any] | undefined
  sql?: string | undefined
  bindings?: any[] | undefined
  nested?: WhereClause[] | undefined
  secondColumn?: string | undefined
}

export interface JoinClause {
  type: 'inner' | 'left' | 'right'
  table: string
  first: string
  operator: string
  second: string
}

export interface OrderClause {
  column: string | Expression
  direction: 'asc' | 'desc'
}

export interface QueryState {
  table: string
  columns: (string | Expression)[]
  distinct: boolean
  wheres: WhereClause[]
  joins: JoinClause[]
  orders: OrderClause[]
  groups: string[]
  havings: WhereClause[]
  limitValue: number | null
  offsetValue: number | null
}

export class QueryBuilder {
  protected state: QueryState
  protected _connection: DatabaseConnection

  constructor(connection: DatabaseConnection, table: string) {
    this._connection = connection
    this.state = {
      table,
      columns: ['*'],
      distinct: false,
      wheres: [],
      joins: [],
      orders: [],
      groups: [],
      havings: [],
      limitValue: null,
      offsetValue: null,
    }
  }

  // ── Selection ─────────────────────────────────────────────────────────────

  select(...columns: (string | Expression)[]): this {
    this.state.columns = columns.length ? columns : ['*']
    return this
  }

  selectRaw(expression: string, bindings?: any[]): this {
    this.state.columns = [new Expression(expression, bindings)]
    return this
  }

  addSelect(...columns: (string | Expression)[]): this {
    if (this.state.columns.length === 1 && this.state.columns[0] === '*') {
      this.state.columns = [...columns]
    } else {
      this.state.columns.push(...columns)
    }
    return this
  }

  distinct(): this {
    this.state.distinct = true
    return this
  }

  // ── Where conditions ───────────────────────────────────────────────────────

  where(column: string | ((q: QueryBuilder) => void), operatorOrValue?: any, value?: any): this {
    if (typeof column === 'function') {
      const sub = new QueryBuilder(this._connection, this.state.table)
      column(sub)
      this.state.wheres.push({ type: 'nested', boolean: 'and', nested: sub.state.wheres })
      return this
    }

    let operator: string
    let val: any
    if (value === undefined) {
      operator = '='
      val = operatorOrValue
    } else {
      operator = operatorOrValue
      val = value
    }

    this.state.wheres.push({ type: 'basic', boolean: 'and', column, operator, value: val })
    return this
  }

  orWhere(column: string | ((q: QueryBuilder) => void), operatorOrValue?: any, value?: any): this {
    if (typeof column === 'function') {
      const sub = new QueryBuilder(this._connection, this.state.table)
      column(sub)
      this.state.wheres.push({ type: 'nested', boolean: 'or', nested: sub.state.wheres })
      return this
    }
    let operator: string
    let val: any
    if (value === undefined) {
      operator = '='
      val = operatorOrValue
    } else {
      operator = operatorOrValue
      val = value
    }
    this.state.wheres.push({ type: 'basic', boolean: 'or', column, operator, value: val })
    return this
  }

  whereIn(column: string, values: any[]): this {
    this.state.wheres.push({ type: 'in', boolean: 'and', column, values })
    return this
  }

  whereNotIn(column: string, values: any[]): this {
    this.state.wheres.push({ type: 'notIn', boolean: 'and', column, values })
    return this
  }

  whereNull(column: string): this {
    this.state.wheres.push({ type: 'null', boolean: 'and', column })
    return this
  }

  whereNotNull(column: string): this {
    this.state.wheres.push({ type: 'notNull', boolean: 'and', column })
    return this
  }

  whereBetween(column: string, range: [any, any]): this {
    this.state.wheres.push({ type: 'between', boolean: 'and', column, range })
    return this
  }

  whereRaw(sql: string, bindings?: any[]): this {
    this.state.wheres.push({ type: 'raw', boolean: 'and', sql, bindings: bindings ?? [] })
    return this
  }

  /**
   * Add a where clause comparing two columns.
   *
   * @example
   *   query.whereColumn('updated_at', '>', 'created_at')
   *   query.whereColumn('first_name', 'last_name') // defaults to '='
   */
  whereColumn(first: string, operatorOrSecond: string, second?: string): this {
    let operator: string
    let secondCol: string
    if (second === undefined) {
      operator = '='
      secondCol = operatorOrSecond
    } else {
      operator = operatorOrSecond
      secondCol = second
    }
    this.state.wheres.push({ type: 'column', boolean: 'and', column: first, operator, secondColumn: secondCol })
    return this
  }

  /**
   * Filter by date part of a datetime column.
   * @example query.whereDate('created_at', '2024-01-15')
   */
  whereDate(column: string, operatorOrValue: string, value?: string): this {
    const [op, val] = value === undefined ? ['=', operatorOrValue] : [operatorOrValue, value]
    return this.whereRaw(`DATE(${sanitizeColumn(column)}) ${sanitizeOperator(op)} ?`, [val])
  }

  /**
   * Filter by month of a datetime column.
   * @example query.whereMonth('created_at', '03')
   */
  whereMonth(column: string, operatorOrValue: string | number, value?: string | number): this {
    const [op, val] = value === undefined ? ['=', operatorOrValue] : [operatorOrValue, value]
    return this.whereRaw(`strftime('%m', ${sanitizeColumn(column)}) ${sanitizeOperator(String(op))} ?`, [String(val).padStart(2, '0')])
  }

  /**
   * Filter by year of a datetime column.
   * @example query.whereYear('created_at', 2024)
   */
  whereYear(column: string, operatorOrValue: string | number, value?: string | number): this {
    const [op, val] = value === undefined ? ['=', operatorOrValue] : [operatorOrValue, value]
    return this.whereRaw(`strftime('%Y', ${sanitizeColumn(column)}) ${sanitizeOperator(String(op))} ?`, [String(val)])
  }

  /**
   * Filter by time part of a datetime column.
   * @example query.whereTime('created_at', '>=', '10:00')
   */
  whereTime(column: string, operatorOrValue: string, value?: string): this {
    const [op, val] = value === undefined ? ['=', operatorOrValue] : [operatorOrValue, value]
    return this.whereRaw(`strftime('%H:%M:%S', ${sanitizeColumn(column)}) ${sanitizeOperator(op)} ?`, [val])
  }

  // ── Joins ───────────────────────────────────────────────────────────────────

  join(table: string, first: string, operator: string, second: string): this {
    // Security: sanitize operator to prevent SQL injection via JOIN clauses (#192)
    this.state.joins.push({ type: 'inner', table, first: sanitizeColumn(first), operator: sanitizeOperator(operator), second: sanitizeColumn(second) })
    return this
  }

  leftJoin(table: string, first: string, operator: string, second: string): this {
    // Security: sanitize operator to prevent SQL injection via JOIN clauses (#192)
    this.state.joins.push({ type: 'left', table, first: sanitizeColumn(first), operator: sanitizeOperator(operator), second: sanitizeColumn(second) })
    return this
  }

  rightJoin(table: string, first: string, operator: string, second: string): this {
    // Security: sanitize operator to prevent SQL injection via JOIN clauses (#192)
    this.state.joins.push({ type: 'right', table, first: sanitizeColumn(first), operator: sanitizeOperator(operator), second: sanitizeColumn(second) })
    return this
  }

  // ── Ordering / Grouping ─────────────────────────────────────────────────────

  orderBy(column: string | Expression, direction: 'asc' | 'desc' = 'asc'): this {
    this.state.orders.push({ column, direction })
    return this
  }

  orderByDesc(column: string): this {
    return this.orderBy(column, 'desc')
  }

  groupBy(...columns: string[]): this {
    this.state.groups.push(...columns)
    return this
  }

  having(column: string, operator: string, value: any): this {
    this.state.havings.push({ type: 'basic', boolean: 'and', column, operator, value })
    return this
  }

  havingRaw(sql: string, bindings?: any[]): this {
    this.state.havings.push({ type: 'raw', boolean: 'and', sql, bindings: bindings ?? [] })
    return this
  }

  // ── Pagination ──────────────────────────────────────────────────────────────

  limit(value: number): this {
    this.state.limitValue = value
    return this
  }

  offset(value: number): this {
    this.state.offsetValue = value
    return this
  }

  take = this.limit
  skip = this.offset

  // ── Execution ───────────────────────────────────────────────────────────────

  async get(): Promise<any[]> {
    return this._connection.executeSelect(this.state)
  }

  async first(): Promise<any> {
    // Use clone to avoid mutating the builder's limitValue (#185)
    const rows = await this.clone().limit(1).get()
    return rows[0] ?? null
  }

  async firstOrFail(): Promise<any> {
    const row = await this.first()
    if (!row) throw new ModelNotFoundError(this.state.table)
    return row
  }

  async find(id: number | string): Promise<Record<string, any> | null> {
    return this.where('id', id).first()
  }

  async value(column: string): Promise<any> {
    const row = await this.select(column).first()
    return row ? row[column] : null
  }

  async pluck(column: string): Promise<any[]> {
    const rows = await this.select(column).get()
    if (!rows || !Array.isArray(rows)) return []
    return rows.map((r) => r[column])
  }

  async exists(): Promise<boolean> {
    return this._connection.executeExists(this.state)
  }

  async doesntExist(): Promise<boolean> {
    return !(await this.exists())
  }

  /**
   * Get the only record matching the query. Throws if zero or more than one.
   */
  async sole(): Promise<Record<string, any>> {
    // Use clone to avoid mutating the builder's limitValue
    const results = await this.clone().limit(2).get()
    if (results.length === 0) throw new ModelNotFoundError(this.state.table)
    if (results.length > 1) throw new Error(`Expected one result for table [${this.state.table}], found multiple.`)
    return results[0]!
  }

  // ── Aggregates ──────────────────────────────────────────────────────────────

  async count(column = '*'): Promise<number> {
    const safeColumn = column === '*' ? '*' : sanitizeColumn(column)
    return this._connection.executeAggregate(this.state, 'count', safeColumn)
  }

  async sum(column: string): Promise<number> {
    return this._connection.executeAggregate(this.state, 'sum', sanitizeColumn(column))
  }

  async avg(column: string): Promise<number> {
    return this._connection.executeAggregate(this.state, 'avg', sanitizeColumn(column))
  }

  async min(column: string): Promise<any> {
    return this._connection.executeAggregate(this.state, 'min', sanitizeColumn(column))
  }

  async max(column: string): Promise<any> {
    return this._connection.executeAggregate(this.state, 'max', sanitizeColumn(column))
  }

  // ── Writes ──────────────────────────────────────────────────────────────────

  async insert(data: Record<string, any> | Record<string, any>[]): Promise<void> {
    const rows = Array.isArray(data) ? data : [data]
    for (const row of rows) {
      await this._connection.executeInsert(this.state.table, row)
    }
  }

  async insertGetId(data: Record<string, any>): Promise<number | string> {
    return this._connection.executeInsertGetId(this.state.table, data)
  }

  async update(data: Record<string, any>): Promise<number> {
    return this._connection.executeUpdate(this.state.table, this.state, data)
  }

  async updateOrInsert(
    conditions: Record<string, any>,
    data: Record<string, any>,
  ): Promise<void> {
    const clone = this.clone()
    for (const [k, v] of Object.entries(conditions)) clone.where(k, v)
    const exists = await clone.exists()
    if (exists) {
      await clone.update(data)
    } else {
      await this.insert({ ...conditions, ...data })
    }
  }

  async delete(): Promise<number> {
    return this._connection.executeDelete(this.state.table, this.state)
  }

  async truncate(): Promise<void> {
    return this._connection.executeTruncate(this.state.table)
  }

  // ── Pagination ──────────────────────────────────────────────────────────────

  async paginate(page = 1, perPage = 15): Promise<PaginationResult<any>> {
    const countQuery = this.clone()
    countQuery.state.orders = []
    const total = await countQuery.count()
    const lastPage = Math.max(1, Math.ceil(total / perPage))
    const currentPage = Math.min(page, lastPage)
    const data = await this.clone().limit(perPage).offset((currentPage - 1) * perPage).get()
    const from = total === 0 ? 0 : (currentPage - 1) * perPage + 1
    const to = Math.min(from + data.length - 1, total)
    return { data, total, perPage, currentPage, lastPage, from, to, hasMore: currentPage < lastPage }
  }

  async cursorPaginate(options: {
    perPage?: number
    cursor?: string | number | null
    cursorColumn?: string
    direction?: 'asc' | 'desc'
  } = {}): Promise<CursorPaginationResult<any>> {
    const { perPage = 15, cursor = null, cursorColumn = 'id', direction = 'desc' } = options

    const query = this.clone()
    if (cursor != null) {
      query.where(cursorColumn, direction === 'desc' ? '<' : '>', cursor)
    }

    const results = await query
      .orderBy(cursorColumn, direction)
      .limit(perPage + 1)
      .get()

    const hasMore = results.length > perPage
    if (hasMore) results.pop()

    return {
      data: results,
      next_cursor: hasMore ? results[results.length - 1]?.[cursorColumn] ?? null : null,
      prev_cursor: cursor ?? null,
      per_page: perPage,
      has_more: hasMore,
    }
  }

  // ── Utilities ───────────────────────────────────────────────────────────────

  /** Returns the SQL for this query. Only works on SQL connections. */
  toSql(): string {
    const grammar = this.getGrammar()
    if (!grammar) throw new Error('toSql() is only available on SQL connections')
    return grammar.compileSelect(this.state).sql
  }

  /** Returns the bindings for this query. Only works on SQL connections. */
  getBindings(): any[] {
    const grammar = this.getGrammar()
    if (!grammar) throw new Error('getBindings() is only available on SQL connections')
    return grammar.compileSelect(this.state).bindings
  }

  clone(): QueryBuilder {
    const copy = new QueryBuilder(this._connection, this.state.table)
    copy.state = {
      ...this.state,
      columns: [...this.state.columns],
      wheres: [...this.state.wheres],
      joins: [...this.state.joins],
      orders: [...this.state.orders],
      groups: [...this.state.groups],
      havings: [...this.state.havings],
    }
    return copy
  }

  getState(): QueryState {
    return this.state
  }

  /** Returns the Grammar if this is a SQL connection, null otherwise. */
  protected getGrammar(): import('../contracts/Grammar.ts').Grammar | null {
    return (this._connection as any)._grammar ?? null
  }
}

// Add macro support — QueryBuilder.macro('name', fn) / instance.__macro('name')
applyMacros(QueryBuilder)

/**
 * Sanitize a column name to prevent SQL injection.
 * Allows: alphanumeric, underscores, dots (table.column), quotes.
 * Rejects anything else.
 */
function sanitizeColumn(column: string): string {
  // Already quoted — pass through
  if (column.startsWith('"') || column.startsWith('`') || column.startsWith("'") || column.startsWith('[')) return column

  // Validate: only allow alphanumeric, underscores, dots
  if (!/^[\w]+(?:\.[\w]+)?$/.test(column)) {
    throw new Error(`Invalid column name: "${column}"`)
  }
  return column
}

const VALID_OPERATORS = new Set(['=', '!=', '<>', '<', '>', '<=', '>=', 'LIKE', 'NOT LIKE', 'IN', 'NOT IN', 'IS', 'IS NOT', 'BETWEEN'])

function sanitizeOperator(op: string): string {
  if (!VALID_OPERATORS.has(op.toUpperCase())) {
    throw new Error(`Invalid SQL operator: "${op}"`)
  }
  return op
}
