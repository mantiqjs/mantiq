import type { SearchEngine, SearchResult } from '../contracts/SearchEngine.ts'
import type { SearchBuilder } from '../SearchBuilder.ts'
import { SearchError } from '../errors/SearchError.ts'

/**
 * Elasticsearch engine driver using REST API.
 */
export class ElasticsearchEngine implements SearchEngine {
  private readonly host: string

  constructor(
    hosts: string[],
    private readonly apiKey?: string,
    private readonly username?: string,
    private readonly password?: string,
  ) {
    this.host = hosts[0] ?? 'http://127.0.0.1:9200'
  }

  async update(models: any[]): Promise<void> {
    if (models.length === 0) return
    const indexName = this.resolveIndexName(models[0])

    // Bulk API
    const lines: string[] = []
    for (const model of models) {
      const id = String(this.resolveKey(model))
      lines.push(JSON.stringify({ index: { _index: indexName, _id: id } }))
      lines.push(JSON.stringify(this.resolveData(model)))
    }

    await this.request('POST', '/_bulk', lines.join('\n') + '\n', 'application/x-ndjson')
  }

  async delete(models: any[]): Promise<void> {
    if (models.length === 0) return
    const indexName = this.resolveIndexName(models[0])

    const lines: string[] = []
    for (const model of models) {
      const id = String(this.resolveKey(model))
      lines.push(JSON.stringify({ delete: { _index: indexName, _id: id } }))
    }

    await this.request('POST', '/_bulk', lines.join('\n') + '\n', 'application/x-ndjson')
  }

  async search(builder: SearchBuilder): Promise<SearchResult> {
    const indexName = this.resolveModelIndexName(builder.model)
    const body = this.buildSearchBody(builder)

    const res = await this.request('POST', `/${indexName}/_search`, body)
    const hits = res.hits?.hits ?? []

    return {
      raw: res,
      keys: hits.map((h: any) => h._id),
      total: res.hits?.total?.value ?? res.hits?.total ?? 0,
    }
  }

  async paginate(builder: SearchBuilder, perPage: number, page: number): Promise<SearchResult> {
    const indexName = this.resolveModelIndexName(builder.model)
    const body = this.buildSearchBody(builder)
    body.size = perPage
    body.from = (page - 1) * perPage

    const res = await this.request('POST', `/${indexName}/_search`, body)
    const hits = res.hits?.hits ?? []

    return {
      raw: res,
      keys: hits.map((h: any) => h._id),
      total: res.hits?.total?.value ?? res.hits?.total ?? 0,
    }
  }

  async flush(indexName: string): Promise<void> {
    try {
      await this.request('POST', `/${indexName}/_delete_by_query`, {
        query: { match_all: {} },
      })
    } catch {
      // Index may not exist
    }
  }

  async createIndex(name: string, options?: Record<string, any>): Promise<void> {
    const body = options ? { settings: options.settings, mappings: options.mappings } : {}
    await this.request('PUT', `/${name}`, body)
  }

  async deleteIndex(name: string): Promise<void> {
    try {
      await this.request('DELETE', `/${name}`)
    } catch {
      // Index may not exist
    }
  }

  private buildSearchBody(builder: SearchBuilder): Record<string, any> {
    const body: Record<string, any> = {}
    const must: any[] = []
    const filter: any[] = []

    // Full-text query
    if (builder.query) {
      must.push({ multi_match: { query: builder.query, type: 'best_fields', fuzziness: 'AUTO' } })
    }

    // Where clauses as term filters
    for (const { field, value } of builder.wheres) {
      filter.push({ term: { [field]: value } })
    }
    for (const { field, values } of builder.whereIns) {
      filter.push({ terms: { [field]: values } })
    }

    if (must.length > 0 || filter.length > 0) {
      body.query = { bool: {} }
      if (must.length > 0) body.query.bool.must = must
      if (filter.length > 0) body.query.bool.filter = filter
    } else {
      body.query = { match_all: {} }
    }

    // Sorting
    if (builder.orders.length > 0) {
      body.sort = builder.orders.map((o) => ({ [o.column]: { order: o.direction } }))
    }

    // Limit / offset
    const limit = builder.getLimit()
    if (limit !== null) body.size = limit
    const offset = builder.getOffset()
    if (offset !== null) body.from = offset

    return body
  }

  private async request(method: string, path: string, body?: any, contentType?: string): Promise<any> {
    const headers: Record<string, string> = {}

    if (contentType) {
      headers['Content-Type'] = contentType
    } else if (body) {
      headers['Content-Type'] = 'application/json'
    }

    if (this.apiKey) {
      headers['Authorization'] = `ApiKey ${this.apiKey}`
    } else if (this.username && this.password) {
      headers['Authorization'] = `Basic ${btoa(`${this.username}:${this.password}`)}`
    }

    const res = await fetch(`${this.host}${path}`, {
      method,
      headers,
      body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    })

    if (!res.ok) {
      const text = await res.text()
      throw new SearchError(`Elasticsearch API error: ${res.status} ${text}`, { status: res.status })
    }

    const ct = res.headers.get('content-type')
    if (ct?.includes('application/json')) return res.json()
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
