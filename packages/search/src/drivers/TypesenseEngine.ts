import type { SearchEngine, SearchResult } from '../contracts/SearchEngine.ts'
import type { SearchBuilder } from '../SearchBuilder.ts'
import { SearchError } from '../errors/SearchError.ts'

/**
 * Typesense engine driver using REST API.
 */
export class TypesenseEngine implements SearchEngine {
  private readonly baseUrl: string

  constructor(
    host: string,
    port: number,
    protocol: 'http' | 'https',
    private readonly apiKey: string,
  ) {
    this.baseUrl = `${protocol}://${host}:${port}`
  }

  async update(models: any[]): Promise<void> {
    if (models.length === 0) return
    const collection = this.resolveIndexName(models[0])
    const documents = models.map((m) => ({
      ...this.resolveData(m),
      id: String(this.resolveKey(m)),
    }))

    // JSONL import
    const jsonl = documents.map((d) => JSON.stringify(d)).join('\n')
    await this.request('POST', `/collections/${collection}/documents/import?action=upsert`, jsonl, 'text/plain')
  }

  async delete(models: any[]): Promise<void> {
    if (models.length === 0) return
    const collection = this.resolveIndexName(models[0])
    const ids = models.map((m) => String(this.resolveKey(m)))

    // Delete individually (Typesense doesn't have batch delete by ID)
    for (const id of ids) {
      try {
        await this.request('DELETE', `/collections/${collection}/documents/${id}`)
      } catch {
        // Ignore 404s
      }
    }
  }

  async search(builder: SearchBuilder): Promise<SearchResult> {
    const collection = this.resolveModelIndexName(builder.model)
    const params = new URLSearchParams({
      q: builder.query || '*',
      query_by: this.resolveQueryBy(builder.model),
    })

    if (builder.getLimit() !== null) params.set('per_page', String(builder.getLimit()))
    if (builder.getOffset() !== null) params.set('offset', String(builder.getOffset()))

    const filter = this.buildFilter(builder)
    if (filter) params.set('filter_by', filter)

    const sort = builder.orders.map((o) => `${o.column}:${o.direction}`).join(',')
    if (sort) params.set('sort_by', sort)

    const res = await this.request('GET', `/collections/${collection}/documents/search?${params}`)

    return {
      raw: res,
      keys: (res.hits ?? []).map((h: any) => h.document?.id),
      total: res.found ?? 0,
    }
  }

  async paginate(builder: SearchBuilder, perPage: number, page: number): Promise<SearchResult> {
    const collection = this.resolveModelIndexName(builder.model)
    const params = new URLSearchParams({
      q: builder.query || '*',
      query_by: this.resolveQueryBy(builder.model),
      per_page: String(perPage),
      page: String(page),
    })

    const filter = this.buildFilter(builder)
    if (filter) params.set('filter_by', filter)

    const sort = builder.orders.map((o) => `${o.column}:${o.direction}`).join(',')
    if (sort) params.set('sort_by', sort)

    const res = await this.request('GET', `/collections/${collection}/documents/search?${params}`)

    return {
      raw: res,
      keys: (res.hits ?? []).map((h: any) => h.document?.id),
      total: res.found ?? 0,
    }
  }

  async flush(indexName: string): Promise<void> {
    try {
      await this.request('DELETE', `/collections/${indexName}`)
    } catch {
      // Collection may not exist
    }
  }

  async createIndex(name: string, options?: Record<string, any>): Promise<void> {
    const schema = {
      name,
      fields: options?.fields ?? [{ name: '.*', type: 'auto' }],
      ...options,
    }
    await this.request('POST', '/collections', schema)
  }

  async deleteIndex(name: string): Promise<void> {
    await this.request('DELETE', `/collections/${name}`)
  }

  private buildFilter(builder: SearchBuilder): string {
    const parts: string[] = []
    for (const { field, value } of builder.wheres) {
      parts.push(`${field}:=${JSON.stringify(value)}`)
    }
    for (const { field, values } of builder.whereIns) {
      parts.push(`${field}:[${values.map((v) => JSON.stringify(v)).join(',')}]`)
    }
    return parts.join(' && ')
  }

  private resolveQueryBy(ModelClass: any): string {
    if (typeof ModelClass.searchableColumns === 'function') {
      return ModelClass.searchableColumns().join(',')
    }
    if (ModelClass.fillable && ModelClass.fillable.length > 0) {
      return ModelClass.fillable.join(',')
    }
    return '*'
  }

  private async request(method: string, path: string, body?: any, contentType?: string): Promise<any> {
    const headers: Record<string, string> = {
      'X-TYPESENSE-API-KEY': this.apiKey,
    }
    if (contentType) {
      headers['Content-Type'] = contentType
    } else if (body && typeof body !== 'string') {
      headers['Content-Type'] = 'application/json'
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    })

    if (!res.ok) {
      const text = await res.text()
      throw new SearchError(`Typesense API error: ${res.status} ${text}`, { status: res.status })
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
