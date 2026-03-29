import type { SearchEngine, SearchResult } from '../contracts/SearchEngine.ts'
import type { SearchBuilder } from '../SearchBuilder.ts'

/**
 * Database-backed search engine using SQL full-text capabilities.
 * - SQLite: LIKE '%query%' across searchable columns
 * - PostgreSQL: to_tsvector() @@ plainto_tsquery()
 * - MySQL: MATCH ... AGAINST (if FULLTEXT index exists, falls back to LIKE)
 */
export class DatabaseEngine implements SearchEngine {
  constructor(private readonly connectionName?: string) {}

  async update(_models: any[]): Promise<void> {
    // No-op: data lives in the database already.
  }

  async delete(_models: any[]): Promise<void> {
    // No-op: data lives in the database already.
  }

  async search(builder: SearchBuilder): Promise<SearchResult> {
    const ModelClass = builder.model
    let query = ModelClass.query()

    if (this.connectionName) {
      query = query.connection(this.connectionName)
    }

    // Apply full-text search
    if (builder.query) {
      query = this.applySearchQuery(query, builder)
    }

    // Apply where clauses
    for (const { field, value } of builder.wheres) {
      query = query.where(field, value)
    }
    for (const { field, values } of builder.whereIns) {
      query = query.whereIn(field, values)
    }

    // Apply ordering
    for (const { column, direction } of builder.orders) {
      query = query.orderBy(column, direction)
    }

    // Apply offset
    const offset = builder.getOffset()
    if (offset !== null && offset > 0) {
      query = query.offset(offset)
    }

    // Apply limit
    const limit = builder.getLimit()
    if (limit !== null) {
      query = query.limit(limit)
    }

    const models = await query.get()
    const pk = ModelClass.primaryKey ?? 'id'
    const keys = models.map((m: any) => m.getAttribute(pk))

    return { raw: models, keys, total: keys.length }
  }

  async paginate(builder: SearchBuilder, perPage: number, page: number): Promise<SearchResult> {
    const ModelClass = builder.model
    let query = ModelClass.query()

    if (this.connectionName) {
      query = query.connection(this.connectionName)
    }

    if (builder.query) {
      query = this.applySearchQuery(query, builder)
    }

    for (const { field, value } of builder.wheres) {
      query = query.where(field, value)
    }
    for (const { field, values } of builder.whereIns) {
      query = query.whereIn(field, values)
    }

    for (const { column, direction } of builder.orders) {
      query = query.orderBy(column, direction)
    }

    // Get total count
    const countQuery = ModelClass.query()
    if (builder.query) this.applySearchQuery(countQuery, builder)
    for (const { field, value } of builder.wheres) countQuery.where(field, value)
    for (const { field, values } of builder.whereIns) countQuery.whereIn(field, values)
    const total = await countQuery.count()

    // Paginate
    const models = await query.limit(perPage).offset((page - 1) * perPage).get()
    const pk = ModelClass.primaryKey ?? 'id'
    const keys = models.map((m: any) => m.getAttribute(pk))

    return { raw: models, keys, total }
  }

  async flush(_indexName: string): Promise<void> {
    // No-op: we don't manage a separate index.
  }

  async createIndex(_name: string): Promise<void> {
    // No-op: database tables are the index.
  }

  async deleteIndex(_name: string): Promise<void> {
    // No-op
  }

  private applySearchQuery(query: any, builder: SearchBuilder): any {
    const searchTerm = builder.query
    const ModelClass = builder.model

    // Get searchable columns from the model, or fall back to fillable
    const columns: string[] = typeof ModelClass.searchableColumns === 'function'
      ? ModelClass.searchableColumns()
      : ModelClass.fillable ?? []

    if (columns.length === 0) return query

    // Escape SQL LIKE wildcards in user input to prevent pattern injection
    const escaped = searchTerm.replace(/[%_\\]/g, '\\$&')
    const likePattern = `%${escaped}%`

    // Use whereRaw with explicit ESCAPE clause for portable LIKE across all
    // database engines (SQLite, Postgres, MySQL, MSSQL) (#213)
    return query.where((q: any) => {
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i]!
        const sql = `${col} LIKE ? ESCAPE '\\'`
        if (i === 0) {
          q.whereRaw(sql, [likePattern])
        } else {
          q.orWhereRaw(sql, [likePattern])
        }
      }
    })
  }
}
