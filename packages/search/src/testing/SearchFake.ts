import type { SearchEngine, SearchResult } from '../contracts/SearchEngine.ts'
import type { SearchBuilder } from '../SearchBuilder.ts'

/**
 * Fake search engine for testing. Stores all indexed records in memory
 * and provides assertion methods.
 */
export class SearchFake implements SearchEngine {
  private indexed = new Map<string, Map<string | number, Record<string, any>>>()
  private deleted = new Map<string, Set<string | number>>()
  private flushed = new Set<string>()

  async update(models: any[]): Promise<void> {
    for (const model of models) {
      const index = this.resolveIndexName(model)
      if (!this.indexed.has(index)) this.indexed.set(index, new Map())
      const key = this.resolveKey(model)
      const data = typeof model.toSearchableArray === 'function'
        ? model.toSearchableArray()
        : { ...model.attributes }
      this.indexed.get(index)!.set(key, data)
    }
  }

  async delete(models: any[]): Promise<void> {
    for (const model of models) {
      const index = this.resolveIndexName(model)
      if (!this.deleted.has(index)) this.deleted.set(index, new Set())
      const key = this.resolveKey(model)
      this.deleted.get(index)!.add(key)
      this.indexed.get(index)?.delete(key)
    }
  }

  async search(builder: SearchBuilder): Promise<SearchResult> {
    const index = this.resolveModelIndexName(builder.model)
    const records = this.indexed.get(index)
    if (!records) return { raw: [], keys: [], total: 0 }

    const keys = Array.from(records.keys())
    return { raw: Array.from(records.values()), keys, total: keys.length }
  }

  async paginate(builder: SearchBuilder, perPage: number, page: number): Promise<SearchResult> {
    const result = await this.search(builder)
    const start = (page - 1) * perPage
    const keys = result.keys.slice(start, start + perPage)
    return { raw: result.raw.slice(start, start + perPage), keys, total: result.total }
  }

  async flush(indexName: string): Promise<void> {
    this.indexed.delete(indexName)
    this.flushed.add(indexName)
  }

  async createIndex(_name: string): Promise<void> {}
  async deleteIndex(_name: string): Promise<void> {}

  // ── Assertions ────────────────────────────────────────────────────

  assertIndexed(modelClass: any, count?: number): void {
    const index = this.resolveStaticIndexName(modelClass)
    const records = this.indexed.get(index)
    const actual = records?.size ?? 0
    if (actual === 0) {
      throw new Error(`Expected [${modelClass.name}] to be indexed, but it was not.`)
    }
    if (count !== undefined && actual !== count) {
      throw new Error(`Expected [${modelClass.name}] to be indexed ${count} time(s), but was indexed ${actual} time(s).`)
    }
  }

  assertNotIndexed(modelClass: any): void {
    const index = this.resolveStaticIndexName(modelClass)
    const records = this.indexed.get(index)
    if (records && records.size > 0) {
      throw new Error(`Expected [${modelClass.name}] to not be indexed, but ${records.size} record(s) found.`)
    }
  }

  assertNothingIndexed(): void {
    let total = 0
    for (const records of this.indexed.values()) total += records.size
    if (total > 0) {
      throw new Error(`Expected nothing to be indexed, but ${total} record(s) found.`)
    }
  }

  assertDeleted(modelClass: any, count?: number): void {
    const index = this.resolveStaticIndexName(modelClass)
    const deletedKeys = this.deleted.get(index)
    const actual = deletedKeys?.size ?? 0
    if (actual === 0) {
      throw new Error(`Expected [${modelClass.name}] to have deletions, but none found.`)
    }
    if (count !== undefined && actual !== count) {
      throw new Error(`Expected ${count} deletion(s) for [${modelClass.name}], but found ${actual}.`)
    }
  }

  assertFlushed(modelClass: any): void {
    const index = this.resolveStaticIndexName(modelClass)
    if (!this.flushed.has(index)) {
      throw new Error(`Expected [${modelClass.name}] index to be flushed, but it was not.`)
    }
  }

  /** Get all indexed records for a model class. */
  getIndexed(modelClass: any): Map<string | number, Record<string, any>> {
    const index = this.resolveStaticIndexName(modelClass)
    return this.indexed.get(index) ?? new Map()
  }

  reset(): void {
    this.indexed.clear()
    this.deleted.clear()
    this.flushed.clear()
  }

  private resolveIndexName(model: any): string {
    const MC = model.constructor
    return typeof MC.searchableAs === 'function' ? MC.searchableAs() : MC.table ?? MC.name.toLowerCase() + 's'
  }

  private resolveModelIndexName(MC: any): string {
    return typeof MC.searchableAs === 'function' ? MC.searchableAs() : MC.table ?? MC.name.toLowerCase() + 's'
  }

  private resolveStaticIndexName(MC: any): string {
    return typeof MC.searchableAs === 'function' ? MC.searchableAs() : MC.table ?? MC.name.toLowerCase() + 's'
  }

  private resolveKey(model: any): string | number {
    return typeof model.searchableKey === 'function' ? model.searchableKey() : model.getAttribute?.('id') ?? model.id
  }
}
