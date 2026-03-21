import type { SearchEngine, SearchResult } from './contracts/SearchEngine.ts'

export interface WhereClause {
  field: string
  value: any
}

export interface WhereInClause {
  field: string
  values: any[]
}

export interface OrderClause {
  column: string
  direction: 'asc' | 'desc'
}

export interface PaginatedSearchResult<T = any> {
  data: T[]
  total: number
  perPage: number
  currentPage: number
  lastPage: number
  hasMorePages: boolean
}

export class SearchBuilder {
  readonly model: any
  readonly query: string
  readonly wheres: WhereClause[] = []
  readonly whereIns: WhereInClause[] = []
  readonly orders: OrderClause[] = []

  private _limit: number | null = null
  private _offset: number | null = null
  private _callback: ((engine: SearchEngine, query: string, builder: SearchBuilder) => any) | null = null
  private _engine: SearchEngine

  constructor(model: any, query: string, engine: SearchEngine, callback?: (engine: SearchEngine, query: string, builder: SearchBuilder) => any) {
    this.model = model
    this.query = query
    this._engine = engine
    this._callback = callback ?? null
  }

  where(field: string, value: any): this {
    this.wheres.push({ field, value })
    return this
  }

  whereIn(field: string, values: any[]): this {
    this.whereIns.push({ field, values })
    return this
  }

  orderBy(column: string, direction: 'asc' | 'desc' = 'asc'): this {
    this.orders.push({ column, direction })
    return this
  }

  take(count: number): this {
    this._limit = count
    return this
  }

  limit(count: number): this {
    return this.take(count)
  }

  skip(count: number): this {
    this._offset = count
    return this
  }

  offset(count: number): this {
    return this.skip(count)
  }

  getLimit(): number | null {
    return this._limit
  }

  getOffset(): number | null {
    return this._offset
  }

  /** Execute the search and return hydrated models. */
  async get(): Promise<any[]> {
    const results = await this.raw()
    if (results.keys.length === 0) return []
    return this.hydrateModels(results)
  }

  /** Execute a paginated search and return hydrated models with pagination info. */
  async paginate(perPage = 15, page = 1): Promise<PaginatedSearchResult> {
    const results = await this._engine.paginate(this, perPage, page)
    const data = results.keys.length > 0 ? await this.hydrateModels(results) : []
    const lastPage = Math.max(1, Math.ceil(results.total / perPage))

    return {
      data,
      total: results.total,
      perPage,
      currentPage: page,
      lastPage,
      hasMorePages: page < lastPage,
    }
  }

  /** Get raw engine results without hydrating models. */
  async raw(): Promise<SearchResult> {
    if (this._callback) {
      return this._callback(this._engine, this.query, this)
    }
    return this._engine.search(this)
  }

  /** Get just the matching model keys/IDs. */
  async keys(): Promise<(string | number)[]> {
    const results = await this.raw()
    return results.keys
  }

  /** Get the total count of matching records. */
  async count(): Promise<number> {
    const results = await this.raw()
    return results.total
  }

  /** Hydrate model instances from the database using the search result keys. */
  private async hydrateModels(results: SearchResult): Promise<any[]> {
    if (results.keys.length === 0) return []

    const ModelClass = this.model
    const pk = ModelClass.primaryKey ?? 'id'

    const models = await ModelClass.query().whereIn(pk, results.keys).get()

    // Preserve search result ordering
    const modelMap = new Map<string | number, any>()
    for (const m of models) {
      modelMap.set(m.getAttribute(pk), m)
    }

    return results.keys
      .map((key) => modelMap.get(key))
      .filter(Boolean)
  }
}
