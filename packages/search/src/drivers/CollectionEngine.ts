import type { SearchEngine, SearchResult } from '../contracts/SearchEngine.ts'
import type { SearchBuilder } from '../SearchBuilder.ts'

/**
 * In-memory search engine for development and testing.
 * Stores indexed records in a Map and searches with string matching.
 */
export class CollectionEngine implements SearchEngine {
  private readonly store = new Map<string, Map<string | number, Record<string, any>>>()

  async update(models: any[]): Promise<void> {
    for (const model of models) {
      const indexName = this.resolveIndexName(model)
      if (!this.store.has(indexName)) this.store.set(indexName, new Map())
      const index = this.store.get(indexName)!

      const key = this.resolveKey(model)
      const data = typeof model.toSearchableArray === 'function'
        ? model.toSearchableArray()
        : { ...model.attributes }

      index.set(key, data)
    }
  }

  async delete(models: any[]): Promise<void> {
    for (const model of models) {
      const indexName = this.resolveIndexName(model)
      const index = this.store.get(indexName)
      if (!index) continue
      index.delete(this.resolveKey(model))
    }
  }

  async search(builder: SearchBuilder): Promise<SearchResult> {
    const indexName = this.resolveModelIndexName(builder.model)
    const index = this.store.get(indexName)

    if (!index) return { raw: [], keys: [], total: 0 }

    let records = Array.from(index.entries()).map(([key, data]) => ({ key, data }))

    // Full-text filter
    if (builder.query) {
      const q = builder.query.toLowerCase()
      records = records.filter(({ data }) =>
        Object.values(data).some((v) =>
          v !== null && v !== undefined && String(v).toLowerCase().includes(q),
        ),
      )
    }

    // Where clauses
    for (const { field, value } of builder.wheres) {
      records = records.filter(({ data }) => data[field] === value)
    }

    // WhereIn clauses
    for (const { field, values } of builder.whereIns) {
      records = records.filter(({ data }) => values.includes(data[field]))
    }

    const total = records.length

    // Order
    for (const { column, direction } of [...builder.orders].reverse()) {
      records.sort((a, b) => {
        const av = a.data[column]
        const bv = b.data[column]
        if (av < bv) return direction === 'asc' ? -1 : 1
        if (av > bv) return direction === 'asc' ? 1 : -1
        return 0
      })
    }

    // Offset
    const offset = builder.getOffset()
    if (offset !== null && offset > 0) {
      records = records.slice(offset)
    }

    // Limit
    const limit = builder.getLimit()
    if (limit !== null) {
      records = records.slice(0, limit)
    }

    return {
      raw: records.map((r) => r.data),
      keys: records.map((r) => r.key),
      total,
    }
  }

  async paginate(builder: SearchBuilder, perPage: number, page: number): Promise<SearchResult> {
    const indexName = this.resolveModelIndexName(builder.model)
    const index = this.store.get(indexName)

    if (!index) return { raw: [], keys: [], total: 0 }

    let records = Array.from(index.entries()).map(([key, data]) => ({ key, data }))

    // Apply filters (same as search)
    if (builder.query) {
      const q = builder.query.toLowerCase()
      records = records.filter(({ data }) =>
        Object.values(data).some((v) =>
          v !== null && v !== undefined && String(v).toLowerCase().includes(q),
        ),
      )
    }
    for (const { field, value } of builder.wheres) {
      records = records.filter(({ data }) => data[field] === value)
    }
    for (const { field, values } of builder.whereIns) {
      records = records.filter(({ data }) => values.includes(data[field]))
    }

    const total = records.length

    for (const { column, direction } of [...builder.orders].reverse()) {
      records.sort((a, b) => {
        const av = a.data[column]
        const bv = b.data[column]
        if (av < bv) return direction === 'asc' ? -1 : 1
        if (av > bv) return direction === 'asc' ? 1 : -1
        return 0
      })
    }

    const start = (page - 1) * perPage
    records = records.slice(start, start + perPage)

    return {
      raw: records.map((r) => r.data),
      keys: records.map((r) => r.key),
      total,
    }
  }

  async flush(indexName: string): Promise<void> {
    this.store.delete(indexName)
  }

  async createIndex(name: string): Promise<void> {
    if (!this.store.has(name)) this.store.set(name, new Map())
  }

  async deleteIndex(name: string): Promise<void> {
    this.store.delete(name)
  }

  /** Get the raw store for testing/debugging. */
  getStore(): Map<string, Map<string | number, Record<string, any>>> {
    return this.store
  }

  private resolveIndexName(model: any): string {
    const ModelClass = model.constructor
    return typeof ModelClass.searchableAs === 'function'
      ? ModelClass.searchableAs()
      : ModelClass.table ?? ModelClass.name.toLowerCase() + 's'
  }

  private resolveModelIndexName(ModelClass: any): string {
    return typeof ModelClass.searchableAs === 'function'
      ? ModelClass.searchableAs()
      : ModelClass.table ?? ModelClass.name.toLowerCase() + 's'
  }

  private resolveKey(model: any): string | number {
    return typeof model.searchableKey === 'function'
      ? model.searchableKey()
      : model.getAttribute?.('id') ?? model.id
  }
}
