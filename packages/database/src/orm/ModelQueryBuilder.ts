import { QueryBuilder } from '../query/Builder.ts'
import { ModelNotFoundError } from '../errors/ModelNotFoundError.ts'
import { eagerLoadRelations, type EagerLoadSpec, normalizeEagerLoads } from './eagerLoad.ts'
import type { Model } from './Model.ts'
import type { DatabaseConnection } from '../contracts/Connection.ts'
import type { PaginationResult, CursorPaginationResult } from '../contracts/Paginator.ts'

export class ModelQueryBuilder<T> extends QueryBuilder {
  private _eagerLoads: string[] = []
  private _eagerConstraints = new Map<string, ((query: ModelQueryBuilder<any>) => void) | null>()
  private _globalScopes = new Map<string, { apply(builder: ModelQueryBuilder<any>, model: any): void }>()
  private _removedScopes = new Set<string>()
  private _modelClass: any = null
  private _scopesApplied = false

  constructor(
    connection: DatabaseConnection,
    table: string,
    private readonly _hydrate: (row: Record<string, any>) => T,
    private readonly softDeleteColumn: string | null = null,
    private _withTrashed = false,
  ) {
    super(connection, table)
    if (softDeleteColumn && !_withTrashed) {
      this.whereNull(softDeleteColumn)
    }
  }

  // ── Eager Loading ───────────────────────────────────────────────────────

  /**
   * Specify relations to eager-load.
   *
   * @example
   *   User.query().with('posts', 'profile').get()
   *   User.query().with('posts.comments').get()
   *   User.query().with({ posts: q => q.where('published', true) }).get()
   */
  with(...specs: EagerLoadSpec[]): this {
    const normalized = normalizeEagerLoads(...specs)
    for (const [name, constraint] of normalized) {
      if (!this._eagerLoads.includes(name)) {
        this._eagerLoads.push(name)
      }
      if (constraint) {
        this._eagerConstraints.set(name, constraint)
      }
    }

    // Also track full dot-notation specs for nested loading
    for (const spec of specs) {
      if (typeof spec === 'string' && spec.includes('.')) {
        if (!this._eagerLoads.includes(spec)) {
          this._eagerLoads.push(spec)
        }
      }
    }

    return this
  }

  withTrashed(): this {
    this._withTrashed = true
    this.state.wheres = this.state.wheres.filter(
      (w) => !(w.type === 'null' && w.column === this.softDeleteColumn),
    )
    return this
  }

  onlyTrashed(): this {
    this._withTrashed = true
    this.state.wheres = this.state.wheres.filter(
      (w) => !(w.type === 'null' && w.column === this.softDeleteColumn),
    )
    if (this.softDeleteColumn) {
      this.whereNotNull(this.softDeleteColumn)
    }
    return this
  }

  // ── Global Scopes ─────────────────────────────────────────────────────────

  /**
   * Register a global scope to be applied before query execution.
   * Called by Model.query() when building the query.
   */
  registerGlobalScope(name: string, scope: { apply(builder: ModelQueryBuilder<any>, model: any): void }): void {
    this._globalScopes.set(name, scope)
  }

  /**
   * Set the model class (for passing to scopes).
   */
  setModel(model: any): this {
    this._modelClass = model
    return this
  }

  /**
   * Remove a specific global scope from this query.
   */
  withoutGlobalScope(name: string): this {
    this._removedScopes.add(name)
    return this
  }

  /**
   * Remove all (or specific) global scopes from this query.
   */
  withoutGlobalScopes(names?: string[]): this {
    if (names) {
      for (const name of names) this._removedScopes.add(name)
    } else {
      for (const name of this._globalScopes.keys()) this._removedScopes.add(name)
    }
    return this
  }

  /**
   * Apply registered global scopes that haven't been removed.
   * Called lazily before query execution.
   */
  private applyGlobalScopes(): void {
    if (this._scopesApplied) return
    this._scopesApplied = true
    for (const [name, scope] of this._globalScopes) {
      if (!this._removedScopes.has(name)) {
        scope.apply(this, this._modelClass)
      }
    }
  }

  // ── Named Scopes ───────────────────────────────────────────────────────────

  /**
   * Apply a named scope defined on the model class via `static scopes`.
   *
   * @example
   *   await Post.query().scope('published').scope('recent').get()
   *   await Post.query().scope('byAuthor', 42).get()
   */
  scope(name: string, ...args: any[]): this {
    if (!this._modelClass) {
      throw new Error('Cannot apply scope: no model class set on this query builder.')
    }
    const scopes = this._modelClass.scopes
    if (!scopes || typeof scopes[name] !== 'function') {
      throw new Error(`Scope [${name}] is not defined on model [${this._modelClass.table || this._modelClass.name}].`)
    }
    scopes[name](this, ...args)
    return this
  }

  // ── Hydrating read methods ─────────────────────────────────────────────────

  override async get(): Promise<T[]> {
    this.applyGlobalScopes()
    const rows = await this.raw().get()
    const models = rows.map(this._hydrate)

    // Eager-load relations if any were requested
    if (this._eagerLoads.length > 0 && models.length > 0) {
      await eagerLoadRelations(
        models as unknown as Model[],
        this._eagerLoads,
        this._eagerConstraints,
      )
    }

    return models
  }

  override async first(): Promise<T | null> {
    this.applyGlobalScopes()
    const row = await this.raw().first()
    if (!row) return null

    const model = this._hydrate(row)

    if (this._eagerLoads.length > 0) {
      await eagerLoadRelations(
        [model as unknown as Model],
        this._eagerLoads,
        this._eagerConstraints,
      )
    }

    return model
  }

  override async firstOrFail(): Promise<T> {
    const result = await this.first()
    if (!result) throw new ModelNotFoundError(this.state.table)
    return result
  }

  override async find(id: number | string): Promise<any> {
    this.applyGlobalScopes()
    const pk = this._modelClass?.primaryKey ?? 'id'
    const row = await this.raw().where(pk, id).first()
    if (!row) return null

    const model = this._hydrate(row)

    if (this._eagerLoads.length > 0) {
      await eagerLoadRelations(
        [model as unknown as Model],
        this._eagerLoads,
        this._eagerConstraints,
      )
    }

    return model
  }

  async findOrFail(id: number | string): Promise<any> {
    const result = await this.find(id)
    if (!result) throw new ModelNotFoundError(this.state.table)
    return result
  }

  // ── Pagination (hydrated) ─────────────────────────────────────────────────

  override async paginate(page = 1, perPage = 15): Promise<PaginationResult<T>> {
    const total = await this.count()
    const lastPage = Math.max(1, Math.ceil(total / perPage))
    const currentPage = Math.min(page, lastPage)
    const originalLimit = this.state.limitValue
    const originalOffset = this.state.offsetValue
    this.state.limitValue = perPage
    this.state.offsetValue = (currentPage - 1) * perPage
    const data = await this.get()
    this.state.limitValue = originalLimit
    this.state.offsetValue = originalOffset
    const from = total === 0 ? 0 : (currentPage - 1) * perPage + 1
    const to = Math.min(from + data.length - 1, total)
    return { data, total, perPage, currentPage, lastPage, from, to, hasMore: currentPage < lastPage }
  }

  override async cursorPaginate(options: {
    perPage?: number
    cursor?: string | number | null
    cursorColumn?: string
    direction?: 'asc' | 'desc'
  } = {}): Promise<CursorPaginationResult<T>> {
    const { perPage = 15, cursor = null, cursorColumn = 'id', direction = 'desc' } = options

    this.applyGlobalScopes()

    const originalLimit = this.state.limitValue
    const originalOffset = this.state.offsetValue
    const originalOrders = [...this.state.orders]
    const originalWheres = [...this.state.wheres]

    try {
      if (cursor != null) {
        this.state.wheres.push({
          type: 'basic',
          boolean: 'and',
          column: cursorColumn,
          operator: direction === 'desc' ? '<' : '>',
          value: cursor,
        })
      }

      this.state.orders = [{ column: cursorColumn, direction }]
      this.state.limitValue = perPage + 1
      this.state.offsetValue = null

      const results = await this.get()

      const hasMore = results.length > perPage
      if (hasMore) results.pop()

      return {
        data: results,
        next_cursor: hasMore ? (results[results.length - 1] as any)?._attributes?.[cursorColumn] ?? (results[results.length - 1] as any)?.[cursorColumn] ?? null : null,
        prev_cursor: cursor ?? null,
        per_page: perPage,
        has_more: hasMore,
      }
    } finally {
      this.state.limitValue = originalLimit
      this.state.offsetValue = originalOffset
      this.state.orders = originalOrders
      this.state.wheres = originalWheres
    }
  }

  // ── Aggregates: delegate to raw QB to bypass hydration ────────────────────

  override async count(column = '*'): Promise<number> {
    this.applyGlobalScopes()
    return this.raw().count(column)
  }

  override async sum(column: string): Promise<number> {
    this.applyGlobalScopes()
    return this.raw().sum(column)
  }

  override async avg(column: string): Promise<number> {
    this.applyGlobalScopes()
    return this.raw().avg(column)
  }

  override async min(column: string): Promise<any> {
    this.applyGlobalScopes()
    return this.raw().min(column)
  }

  override async max(column: string): Promise<any> {
    this.applyGlobalScopes()
    return this.raw().max(column)
  }

  override async exists(): Promise<boolean> {
    this.applyGlobalScopes()
    return this.raw().exists()
  }

  override async doesntExist(): Promise<boolean> {
    this.applyGlobalScopes()
    return this.raw().doesntExist()
  }

  override async value(column: string): Promise<any> {
    this.applyGlobalScopes()
    return this.raw().value(column)
  }

  override async pluck(column: string): Promise<any[]> {
    this.applyGlobalScopes()
    return this.raw().pluck(column)
  }

  // ── Batch Processing ─────────────────────────────────────────────────────

  /**
   * Process results in chunks. The callback receives each chunk and can
   * return false to stop processing.
   *
   * @example
   *   await User.query().chunk(100, async (users) => {
   *     for (const user of users) await user.process()
   *   })
   */
  async chunk(size: number, callback: (items: T[], page: number) => Promise<false | void> | false | void): Promise<void> {
    let page = 1
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const originalLimit = this.state.limitValue
      const originalOffset = this.state.offsetValue
      let results: T[]
      try {
        this.state.limitValue = size
        this.state.offsetValue = (page - 1) * size
        results = await this.get()
      } finally {
        this.state.limitValue = originalLimit
        this.state.offsetValue = originalOffset
      }

      if (results.length === 0) break

      const result = await callback(results, page)
      if (result === false) break
      if (results.length < size) break

      page++
    }
  }

  /**
   * Process results in chunks ordered by ID. More efficient for large
   * tables because it uses WHERE id > lastId instead of OFFSET.
   *
   * @example
   *   await User.query().chunkById(100, async (users) => {
   *     for (const user of users) await user.process()
   *   })
   */
  async chunkById(
    size: number,
    callback: (items: T[], page: number) => Promise<false | void> | false | void,
    column = 'id',
  ): Promise<void> {
    let lastId: any = null
    let page = 1
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const originalLimit = this.state.limitValue
      const originalOrders = [...this.state.orders]
      const originalWheres = [...this.state.wheres]
      let results: T[]
      try {
        this.state.limitValue = size
        this.state.orders = [{ column, direction: 'asc' }]

        // Add id constraint
        if (lastId !== null) {
          this.state.wheres.push({ type: 'basic', boolean: 'and', column, operator: '>', value: lastId })
        }

        results = await this.get()
      } finally {
        // Restore state
        this.state.limitValue = originalLimit
        this.state.orders = originalOrders
        this.state.wheres = originalWheres
      }

      if (results.length === 0) break

      const lastItem = results[results.length - 1] as any
      lastId = lastItem._attributes?.[column] ?? lastItem[column]

      const result = await callback(results, page)
      if (result === false) break
      if (results.length < size) break

      page++
    }
  }

  /**
   * Lazily iterate over results using an async generator.
   * Fetches rows in batches internally but yields them one at a time.
   *
   * @example
   *   for await (const user of User.query().cursor()) {
   *     await user.sendEmail()
   *   }
   */
  async *cursor(batchSize = 200): AsyncGenerator<T, void, undefined> {
    let offset = 0
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const originalLimit = this.state.limitValue
      const originalOffset = this.state.offsetValue
      let results: T[]
      try {
        this.state.limitValue = batchSize
        this.state.offsetValue = offset
        results = await this.get()
      } finally {
        this.state.limitValue = originalLimit
        this.state.offsetValue = originalOffset
      }

      for (const item of results) {
        yield item
      }

      if (results.length < batchSize) break
      offset += batchSize
    }
  }

  // ── sole() ──────────────────────────────────────────────────────────────

  /**
   * Get the only record matching the query. Throws if zero or more than one.
   *
   * @example
   *   const user = await User.where('email', 'admin@example.com').sole()
   */
  override async sole(): Promise<any> {
    this.applyGlobalScopes()
    const originalLimit = this.state.limitValue
    this.state.limitValue = 2
    const results = await this.get()
    this.state.limitValue = originalLimit

    if (results.length === 0) throw new ModelNotFoundError(this.state.table)
    if (results.length > 1) throw new Error(`Expected one result for table [${this.state.table}], found multiple.`)
    return results[0]!
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  /** Snapshot current state into a plain QueryBuilder (no hydration) */
  private raw(): QueryBuilder {
    const q = new QueryBuilder(this._connection, this.state.table)
    q['state'] = {
      table: this.state.table,
      columns: [...this.state.columns],
      distinct: this.state.distinct,
      wheres: [...this.state.wheres],
      joins: [...this.state.joins],
      orders: [...this.state.orders],
      groups: [...this.state.groups],
      havings: [...this.state.havings],
      limitValue: this.state.limitValue,
      offsetValue: this.state.offsetValue,
    }
    return q
  }
}
