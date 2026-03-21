import type { SearchBuilder } from '../SearchBuilder.ts'

export interface SearchResult {
  /** Raw results from the engine (format varies by driver) */
  raw: any
  /** Mapped model keys from the results */
  keys: (string | number)[]
  /** Total number of matching records (for pagination) */
  total: number
}

export interface SearchEngine {
  /** Upsert models into the search index */
  update(models: any[]): Promise<void>

  /** Remove models from the search index */
  delete(models: any[]): Promise<void>

  /** Perform a search query */
  search(builder: SearchBuilder): Promise<SearchResult>

  /** Perform a paginated search query */
  paginate(builder: SearchBuilder, perPage: number, page: number): Promise<SearchResult>

  /** Remove all records for a model from its index */
  flush(indexName: string): Promise<void>

  /** Create a search index */
  createIndex(name: string, options?: Record<string, any>): Promise<void>

  /** Delete a search index */
  deleteIndex(name: string): Promise<void>
}
