import type { SearchEngine, SearchResult } from '../contracts/SearchEngine.ts'
import type { SearchBuilder } from '../SearchBuilder.ts'
import { SearchError } from '../errors/SearchError.ts'

/**
 * Meilisearch engine driver using REST API.
 */
export class MeilisearchEngine implements SearchEngine {
  constructor(
    private readonly host: string,
    private readonly apiKey: string,
  ) {}

  async update(models: any[]): Promise<void> {
    if (models.length === 0) return
    const indexName = this.resolveIndexName(models[0])
    const documents = models.map((m) => ({
      id: this.resolveKey(m),
      ...this.resolveData(m),
    }))
    await this.request('POST', `/indexes/${encodeURIComponent(indexName)}/documents`, documents)
  }

  async delete(models: any[]): Promise<void> {
    if (models.length === 0) return
    const indexName = this.resolveIndexName(models[0])
    const ids = models.map((m) => this.resolveKey(m))
    await this.request('POST', `/indexes/${encodeURIComponent(indexName)}/documents/delete-batch`, ids)
  }

  async search(builder: SearchBuilder): Promise<SearchResult> {
    const indexName = this.resolveModelIndexName(builder.model)
    const body: Record<string, any> = { q: builder.query }

    if (builder.getLimit() !== null) body.limit = builder.getLimit()
    if (builder.getOffset() !== null) body.offset = builder.getOffset()

    const filter = this.buildFilter(builder)
    if (filter.length > 0) body.filter = filter

    const sort = builder.orders.map((o) => `${o.column}:${o.direction}`)
    if (sort.length > 0) body.sort = sort

    const res = await this.request('POST', `/indexes/${encodeURIComponent(indexName)}/search`, body)

    return {
      raw: res,
      keys: (res.hits ?? []).map((h: any) => h.id),
      total: res.estimatedTotalHits ?? res.totalHits ?? 0,
    }
  }

  async paginate(builder: SearchBuilder, perPage: number, page: number): Promise<SearchResult> {
    const indexName = this.resolveModelIndexName(builder.model)
    const body: Record<string, any> = {
      q: builder.query,
      hitsPerPage: perPage,
      page,
    }

    const filter = this.buildFilter(builder)
    if (filter.length > 0) body.filter = filter

    const sort = builder.orders.map((o) => `${o.column}:${o.direction}`)
    if (sort.length > 0) body.sort = sort

    const res = await this.request('POST', `/indexes/${encodeURIComponent(indexName)}/search`, body)

    return {
      raw: res,
      keys: (res.hits ?? []).map((h: any) => h.id),
      total: res.totalHits ?? res.estimatedTotalHits ?? 0,
    }
  }

  async flush(indexName: string): Promise<void> {
    await this.request('DELETE', `/indexes/${encodeURIComponent(indexName)}/documents`)
  }

  async createIndex(name: string, options?: Record<string, any>): Promise<void> {
    await this.request('POST', '/indexes', { uid: name, primaryKey: options?.primaryKey ?? 'id' })
  }

  async deleteIndex(name: string): Promise<void> {
    await this.request('DELETE', `/indexes/${encodeURIComponent(name)}`)
  }

  private buildFilter(builder: SearchBuilder): string[] {
    const filters: string[] = []
    for (const { field, value } of builder.wheres) {
      filters.push(`${field} = ${JSON.stringify(value)}`)
    }
    for (const { field, values } of builder.whereIns) {
      const parts = values.map((v) => `${field} = ${JSON.stringify(v)}`)
      filters.push(parts.join(' OR '))
    }
    return filters
  }

  private async request(method: string, path: string, body?: any): Promise<any> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`

    const res = await fetch(`${this.host}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!res.ok) {
      const text = await res.text()
      throw new SearchError(`Meilisearch API error: ${res.status} ${text}`, { status: res.status })
    }

    const contentType = res.headers.get('content-type')
    if (contentType?.includes('application/json')) return res.json()
    return {}
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
