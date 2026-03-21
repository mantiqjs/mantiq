import { SearchBuilder } from './SearchBuilder.ts'
import { SearchObserver } from './SearchObserver.ts'
import { getSearchManager } from './helpers/search.ts'

/**
 * Makes a Model class searchable. Call in static booted().
 *
 * Adds: Model.search(query), Model.makeAllSearchable(), Model.removeAllFromSearch(),
 *       instance.toSearchableArray(), instance.searchableKey(), instance.shouldBeSearchable()
 */
export function makeSearchable(ModelClass: any): void {
  // ── Static methods ──────────────────────────────────────────────

  /** Start a search query against the model's search index. */
  ModelClass.search = function (query: string, callback?: any): SearchBuilder {
    const manager = getSearchManager()
    return new SearchBuilder(this, query, manager.driver(), callback)
  }

  /** Get the search index name for this model. */
  if (!ModelClass.searchableAs) {
    ModelClass.searchableAs = function (): string {
      const prefix = getSearchManager().getPrefix()
      return prefix + (this.table ?? this.name.toLowerCase() + 's')
    }
  }

  /** Import all model records into the search index. */
  ModelClass.makeAllSearchable = async function (chunkSize = 500): Promise<void> {
    const manager = getSearchManager()
    const engine = manager.driver()
    let offset = 0

    while (true) {
      const models = await this.query().limit(chunkSize).offset(offset).get()
      if (models.length === 0) break

      const searchable = models.filter((m: any) =>
        typeof m.shouldBeSearchable === 'function' ? m.shouldBeSearchable() : true,
      )

      if (searchable.length > 0) {
        await engine.update(searchable)
      }

      if (models.length < chunkSize) break
      offset += chunkSize
    }
  }

  /** Remove all model records from the search index. */
  ModelClass.removeAllFromSearch = async function (): Promise<void> {
    const manager = getSearchManager()
    const indexName = this.searchableAs()
    await manager.driver().flush(indexName)
  }

  // ── Instance methods (defaults, overridable by the model) ───────

  if (!ModelClass.prototype.toSearchableArray) {
    ModelClass.prototype.toSearchableArray = function (): Record<string, any> {
      return this.toObject ? this.toObject() : { ...this.attributes }
    }
  }

  if (!ModelClass.prototype.searchableKey) {
    ModelClass.prototype.searchableKey = function (): string | number {
      const pk = (this.constructor as any).primaryKey ?? 'id'
      return this.getAttribute(pk)
    }
  }

  if (!ModelClass.prototype.shouldBeSearchable) {
    ModelClass.prototype.shouldBeSearchable = function (): boolean {
      return true
    }
  }

  // ── Register observer for auto-indexing ─────────────────────────

  try {
    const observer = new SearchObserver()
    if (typeof ModelClass.observe === 'function') {
      ModelClass.observe(observer)
    }
  } catch {
    // Events package may not be available — manual indexing only
  }
}
