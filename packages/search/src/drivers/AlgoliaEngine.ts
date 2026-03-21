import type { SearchEngine, SearchResult } from '../contracts/SearchEngine.ts'
import type { SearchBuilder } from '../SearchBuilder.ts'
import { SearchError } from '../errors/SearchError.ts'

/**
 * Algolia search engine driver using REST API (no SDK).
 */
export class AlgoliaEngine implements SearchEngine {
  private readonly baseUrl: string

  constructor(
    private readonly applicationId: string,
    private readonly apiKey: string,
    private readonly indexSettings?: Record<string, any>,
  ) {
    this.baseUrl = `https://${applicationId}-dsn.algolia.net`
  }

  async update(models: any[]): Promise<void> {
    if (models.length === 0) return

    const indexName = this.resolveIndexName(models[0])
    const objects = models.map((m) => ({
      objectID: String(this.resolveKey(m)),
      ...this.resolveData(m),
    }))

    await this.request('POST', `/1/indexes/${encodeURIComponent(indexName)}/batch`, {
      requests: objects.map((obj) => ({ action: 'updateObject', body: obj })),
    })
  }

  async delete(models: any[]): Promise<void> {
    if (models.length === 0) return

    const indexName = this.resolveIndexName(models[0])
    const objectIDs = models.map((m) => String(this.resolveKey(m)))

    await this.request('POST', `/1/indexes/${encodeURIComponent(indexName)}/batch`, {
      requests: objectIDs.map((id) => ({ action: 'deleteObject', body: { objectID: id } })),
    })
  }

  async search(builder: SearchBuilder): Promise<SearchResult> {
    const indexName = this.resolveModelIndexName(builder.model)

    const params: Record<string, any> = { query: builder.query }
    if (builder.getLimit() !== null) params.hitsPerPage = builder.getLimit()

    const filters = this.buildFilters(builder)
    if (filters) params.filters = filters

    const res = await this.request('POST', `/1/indexes/${encodeURIComponent(indexName)}/query`, params)

    return {
      raw: res,
      keys: (res.hits ?? []).map((h: any) => h.objectID),
      total: res.nbHits ?? 0,
    }
  }

  async paginate(builder: SearchBuilder, perPage: number, page: number): Promise<SearchResult> {
    const indexName = this.resolveModelIndexName(builder.model)

    const params: Record<string, any> = {
      query: builder.query,
      hitsPerPage: perPage,
      page: page - 1, // Algolia is 0-indexed
    }

    const filters = this.buildFilters(builder)
    if (filters) params.filters = filters

    const res = await this.request('POST', `/1/indexes/${encodeURIComponent(indexName)}/query`, params)

    return {
      raw: res,
      keys: (res.hits ?? []).map((h: any) => h.objectID),
      total: res.nbHits ?? 0,
    }
  }

  async flush(indexName: string): Promise<void> {
    await this.request('POST', `/1/indexes/${encodeURIComponent(indexName)}/clear`, {})
  }

  async createIndex(name: string, options?: Record<string, any>): Promise<void> {
    const settings = { ...this.indexSettings, ...options }
    if (Object.keys(settings).length > 0) {
      await this.request('PUT', `/1/indexes/${encodeURIComponent(name)}/settings`, settings)
    }
  }

  async deleteIndex(name: string): Promise<void> {
    await this.request('DELETE', `/1/indexes/${encodeURIComponent(name)}`)
  }

  private buildFilters(builder: SearchBuilder): string {
    const parts: string[] = []
    for (const { field, value } of builder.wheres) {
      parts.push(`${field}:${JSON.stringify(value)}`)
    }
    for (const { field, values } of builder.whereIns) {
      const orParts = values.map((v) => `${field}:${JSON.stringify(v)}`)
      parts.push(`(${orParts.join(' OR ')})`)
    }
    return parts.join(' AND ')
  }

  private async request(method: string, path: string, body?: any): Promise<any> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Algolia-Application-Id': this.applicationId,
        'X-Algolia-API-Key': this.apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!res.ok) {
      const text = await res.text()
      throw new SearchError(`Algolia API error: ${res.status} ${text}`, { status: res.status })
    }

    return res.json()
  }

  private resolveIndexName(model: any): string {
    const MC = model.constructor
    return typeof MC.searchableAs === 'function' ? MC.searchableAs() : MC.table ?? MC.name.toLowerCase() + 's'
  }

  private resolveModelIndexName(MC: any): string {
    return typeof MC.searchableAs === 'function' ? MC.searchableAs() : MC.table ?? MC.name.toLowerCase() + 's'
  }

  private resolveKey(model: any): string | number {
    return typeof model.searchableKey === 'function' ? model.searchableKey() : model.getAttribute?.('id') ?? model.id
  }

  private resolveData(model: any): Record<string, any> {
    return typeof model.toSearchableArray === 'function' ? model.toSearchableArray() : { ...model.attributes }
  }
}
