import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { ElasticsearchEngine } from '../../src/drivers/ElasticsearchEngine.ts'
import { SearchBuilder } from '../../src/SearchBuilder.ts'
import type { SearchEngine } from '../../src/contracts/SearchEngine.ts'

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const products = [
  { id: 1, name: 'MacBook Pro', category: 'laptops', price: 2499, description: 'Apple laptop with M3 chip' },
  { id: 2, name: 'ThinkPad X1', category: 'laptops', price: 1899, description: 'Lenovo business laptop' },
  { id: 3, name: 'iPhone 16', category: 'phones', price: 999, description: 'Apple smartphone' },
  { id: 4, name: 'Galaxy S24', category: 'phones', price: 899, description: 'Samsung smartphone' },
  { id: 5, name: 'AirPods Pro', category: 'audio', price: 249, description: 'Apple wireless earbuds' },
  { id: 6, name: 'Pixel Watch 3', category: 'wearables', price: 349, description: 'Google smartwatch' },
  { id: 7, name: 'Surface Laptop Go', category: 'laptops', price: 799, description: 'Microsoft affordable laptop' },
  { id: 8, name: 'HomePod Mini', category: 'audio', price: 99, description: 'Apple smart speaker' },
]

// ---------------------------------------------------------------------------
// Model mocks
// ---------------------------------------------------------------------------

const INDEX_NAME = 'test_es_products'

const mockModel = {
  searchableAs: () => INDEX_NAME,
  searchableColumns: () => ['name', 'description'],
  fillable: ['name', 'category', 'price', 'description'],
  primaryKey: 'id',
  table: 'products',
}

class ProductModel {
  constructor(public data: (typeof products)[number]) {}
  static searchableAs() { return INDEX_NAME }
  searchableKey(): number { return this.data.id }
  toSearchableArray(): Record<string, any> { return { ...this.data } }
}

function toModels(items: typeof products = products): ProductModel[] {
  return items.map((p) => new ProductModel(p))
}

function esBuilder(engine: SearchEngine, query: string): SearchBuilder {
  return new SearchBuilder(mockModel, query, engine)
}

// ---------------------------------------------------------------------------
// Connectivity
// ---------------------------------------------------------------------------

async function isReachable(url: string): Promise<boolean> {
  try {
    await fetch(url, { signal: AbortSignal.timeout(2000) })
    return true
  } catch {
    return false
  }
}

const esHost = process.env.ES_HOST ?? 'http://localhost:9200'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ElasticsearchEngine — extended', () => {
  let engine: ElasticsearchEngine
  let available = false

  async function refreshIndex(): Promise<void> {
    await fetch(`${esHost}/${INDEX_NAME}/_refresh`, { method: 'POST' })
  }

  beforeAll(async () => {
    available = await isReachable(esHost)
    if (!available) return

    engine = new ElasticsearchEngine([esHost])

    try { await engine.deleteIndex(INDEX_NAME) } catch { /* ignore */ }

    // Create index with explicit mapping for keyword fields
    await engine.createIndex(INDEX_NAME, {
      mappings: {
        properties: {
          name: { type: 'text' },
          category: { type: 'keyword' },
          price: { type: 'integer' },
          description: { type: 'text' },
        },
      },
    })

    await engine.update(toModels())
    await refreshIndex()
  })

  afterAll(async () => {
    if (!available) return
    try { await engine.deleteIndex(INDEX_NAME) } catch { /* ignore */ }
  })

  test('skip if Elasticsearch is not available', () => {
    if (!available) console.warn('  Elasticsearch not available — skipping')
    expect(true).toBe(true)
  })

  // ── createIndex with mapping ─────────────────────────────────────────

  test('createIndex with custom mapping', async () => {
    if (!available) return
    const tempIndex = 'test_es_temp_mapping'
    await engine.createIndex(tempIndex, {
      mappings: {
        properties: {
          title: { type: 'text' },
          tags: { type: 'keyword' },
        },
      },
    })
    // Clean up
    await engine.deleteIndex(tempIndex)
  })

  // ── index documents ──────────────────────────────────────────────────

  test('indexed documents are searchable', async () => {
    if (!available) return
    const result = await engine.search(esBuilder(engine, ''))
    expect(result.total).toBeGreaterThanOrEqual(8)
  })

  // ── search with query_string ─────────────────────────────────────────

  test('search "Apple" returns Apple products', async () => {
    if (!available) return
    const result = await engine.search(esBuilder(engine, 'Apple'))
    const keys = result.keys.map(Number).sort((a, b) => a - b)
    expect(keys).toContain(1) // MacBook Pro
    expect(keys).toContain(3) // iPhone
    expect(keys).toContain(5) // AirPods
  })

  test('search "laptop" returns laptop products', async () => {
    if (!available) return
    const result = await engine.search(esBuilder(engine, 'laptop'))
    const keys = result.keys.map(Number).sort((a, b) => a - b)
    expect(keys).toContain(1)
    expect(keys).toContain(2)
  })

  // ── filter with bool query ───────────────────────────────────────────

  test('filter with where category = phones', async () => {
    if (!available) return
    const b = esBuilder(engine, '')
    b.where('category', 'phones')
    const result = await engine.search(b)
    const keys = result.keys.map(Number).sort((a, b) => a - b)
    expect(keys).toEqual([3, 4])
  })

  test('filter with whereIn categories', async () => {
    if (!available) return
    const b = esBuilder(engine, '')
    b.whereIn('category', ['audio', 'wearables'])
    const result = await engine.search(b)
    const keys = result.keys.map(Number).sort((a, b) => a - b)
    expect(keys).toEqual([5, 6, 8])
  })

  test('combined query + filter: "Apple" in category laptops', async () => {
    if (!available) return
    const b = esBuilder(engine, 'Apple')
    b.where('category', 'laptops')
    const result = await engine.search(b)
    const keys = result.keys.map(Number)
    expect(keys).toContain(1)
    expect(keys).not.toContain(3) // iPhone is phones
  })

  // ── sort ─────────────────────────────────────────────────────────────

  test('sort by price ascending', async () => {
    if (!available) return
    const b = esBuilder(engine, '')
    b.orderBy('price', 'asc')
    const result = await engine.search(b)
    const prices = result.raw.hits.hits.map((h: any) => h._source.price)
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1])
    }
  })

  // ── paginate ─────────────────────────────────────────────────────────

  test('paginate page 1 perPage 3', async () => {
    if (!available) return
    const result = await engine.paginate(esBuilder(engine, ''), 3, 1)
    expect(result.keys.length).toBe(3)
    expect(result.total).toBeGreaterThanOrEqual(8)
  })

  test('paginate page 2 has no overlap with page 1', async () => {
    if (!available) return
    const b = esBuilder(engine, '')
    b.orderBy('price', 'asc') // deterministic ordering
    const page1 = await engine.paginate(b, 3, 1)

    const b2 = esBuilder(engine, '')
    b2.orderBy('price', 'asc')
    const page2 = await engine.paginate(b2, 3, 2)

    const overlap = page1.keys.filter((k) => page2.keys.map(String).includes(String(k)))
    expect(overlap.length).toBe(0)
  })

  // ── delete index ─────────────────────────────────────────────────────

  test('deleteIndex removes the index', async () => {
    if (!available) return
    const tempIndex = 'test_es_delete_me'
    await engine.createIndex(tempIndex)
    await engine.deleteIndex(tempIndex)

    // Searching the deleted index should throw
    try {
      await engine.search(new SearchBuilder({ searchableAs: () => tempIndex }, '', engine))
      expect(true).toBe(false) // Should not reach here
    } catch (err: any) {
      expect(err.message).toContain('Elasticsearch')
    }
  })
})
