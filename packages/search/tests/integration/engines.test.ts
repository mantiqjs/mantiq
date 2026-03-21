import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { MeilisearchEngine } from '../../src/drivers/MeilisearchEngine.ts'
import { TypesenseEngine } from '../../src/drivers/TypesenseEngine.ts'
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
]

// ---------------------------------------------------------------------------
// Mock model class — used as builder.model (the "ModelClass")
// ---------------------------------------------------------------------------

const INDEX_NAME = 'test_products'

const mockModel = {
  searchableAs: () => INDEX_NAME,
  searchableColumns: () => ['name', 'description'],
  fillable: ['name', 'category', 'price', 'description'],
  primaryKey: 'id',
  table: 'products',
  query: () => ({ whereIn: () => ({ get: async () => products }) }),
}

// ---------------------------------------------------------------------------
// Helper: wrap raw product data as model instances the engines understand
// ---------------------------------------------------------------------------

class ProductModel {
  constructor(public data: (typeof products)[number]) {}

  static searchableAs() {
    return INDEX_NAME
  }

  searchableKey(): number {
    return this.data.id
  }

  toSearchableArray(): Record<string, any> {
    return { ...this.data }
  }
}

function toModels(items: typeof products = products): ProductModel[] {
  return items.map((p) => new ProductModel(p))
}

// ---------------------------------------------------------------------------
// Helper: create a SearchBuilder bound to an engine
// ---------------------------------------------------------------------------

function builder(engine: SearchEngine, query: string): SearchBuilder {
  return new SearchBuilder(mockModel, query, engine)
}

// ---------------------------------------------------------------------------
// Connectivity checks
// ---------------------------------------------------------------------------

async function isReachable(url: string): Promise<boolean> {
  try {
    await fetch(url, { signal: AbortSignal.timeout(2000) })
    return true
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Env config
// ---------------------------------------------------------------------------

const meiliHost = process.env.MEILI_HOST ?? 'http://localhost:7700'
const meiliKey = process.env.MEILI_KEY ?? 'testkey'

const typesenseHost = process.env.TYPESENSE_HOST ?? 'localhost'
const typesensePort = Number(process.env.TYPESENSE_PORT ?? 8108)
const typesenseKey = process.env.TYPESENSE_KEY ?? 'testkey'

const esHost = process.env.ES_HOST ?? 'http://localhost:9200'

// ---------------------------------------------------------------------------
// Shared assertion helpers
// ---------------------------------------------------------------------------

function expectIdsToMatch(keys: (string | number)[], expectedIds: number[]) {
  const numericKeys = keys.map(Number).sort((a, b) => a - b)
  expect(numericKeys).toEqual([...expectedIds].sort((a, b) => a - b))
}

// ---------------------------------------------------------------------------
// Meilisearch
// ---------------------------------------------------------------------------

describe('MeilisearchEngine', () => {
  let engine: MeilisearchEngine
  let available = false

  beforeAll(async () => {
    available = await isReachable(meiliHost)
    if (!available) return

    engine = new MeilisearchEngine(meiliHost, meiliKey)

    // Clean up any leftover index from a previous run
    try {
      await engine.deleteIndex(INDEX_NAME)
      // Wait for delete task to complete
      await new Promise((r) => setTimeout(r, 1000))
    } catch {
      // Index may not exist
    }
  })

  afterAll(async () => {
    if (!available) return
    try {
      await engine.deleteIndex(INDEX_NAME)
    } catch {
      // Ignore
    }
  })

  test('skip if Meilisearch is not available', () => {
    if (!available) {
      console.warn('  ⏭ Meilisearch not available — skipping')
    }
    expect(true).toBe(true)
  })

  test('createIndex', async () => {
    if (!available) return
    await engine.createIndex(INDEX_NAME)
    // Wait for async index creation
    await new Promise((r) => setTimeout(r, 1000))
    // Configure filterable attributes for filter tests
    await fetch(`${meiliHost}/indexes/${INDEX_NAME}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(meiliKey ? { Authorization: `Bearer ${meiliKey}` } : {}) },
      body: JSON.stringify({ filterableAttributes: ['category', 'price'], sortableAttributes: ['name', 'price'] }),
    })
    await new Promise((r) => setTimeout(r, 1000))
  })

  test('update — index all products', async () => {
    if (!available) return
    await engine.update(toModels())
    // Meilisearch indexes asynchronously — wait for it
    await new Promise((r) => setTimeout(r, 2000))
  })

  test('search "Apple" returns products 1, 3, 5', async () => {
    if (!available) return
    const result = await engine.search(builder(engine, 'Apple'))
    expectIdsToMatch(result.keys, [1, 3, 5])
  })

  test('search "laptop" returns products 1, 2', async () => {
    if (!available) return
    const result = await engine.search(builder(engine, 'laptop'))
    expectIdsToMatch(result.keys, [1, 2])
  })

  test('search with where filter category = phones', async () => {
    if (!available) return

    // Meilisearch requires filterable attributes to be configured
    await fetch(`${meiliHost}/indexes/${INDEX_NAME}/settings/filterable-attributes`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${meiliKey}`,
      },
      body: JSON.stringify(['category', 'price']),
    })
    await new Promise((r) => setTimeout(r, 1500))

    const b = builder(engine, '')
    b.where('category', 'phones')
    const result = await engine.search(b)
    expectIdsToMatch(result.keys, [3, 4])
  })

  test('search with whereIn filter category IN [laptops, audio]', async () => {
    if (!available) return
    const b = builder(engine, '')
    b.whereIn('category', ['laptops', 'audio'])
    const result = await engine.search(b)
    expectIdsToMatch(result.keys, [1, 2, 5])
  })

  test('paginate — page 1, perPage 2', async () => {
    if (!available) return
    const b = builder(engine, '')
    const result = await engine.paginate(b, 2, 1)
    expect(result.keys.length).toBe(2)
    expect(result.total).toBeGreaterThanOrEqual(5)
  })

  test('delete — remove product 5, search "Apple" returns 1, 3', async () => {
    if (!available) return
    const product5 = toModels(products.filter((p) => p.id === 5))
    await engine.delete(product5)
    await new Promise((r) => setTimeout(r, 2000))

    const result = await engine.search(builder(engine, 'Apple'))
    expectIdsToMatch(result.keys, [1, 3])
  })

  test('flush — clear all, search returns 0', async () => {
    if (!available) return
    await engine.flush(INDEX_NAME)
    await new Promise((r) => setTimeout(r, 2000))

    const result = await engine.search(builder(engine, ''))
    expect(result.keys.length).toBe(0)
  })

  test('deleteIndex — cleanup', async () => {
    if (!available) return
    await engine.deleteIndex(INDEX_NAME)
    await new Promise((r) => setTimeout(r, 1000))
  })
})

// ---------------------------------------------------------------------------
// Typesense
// ---------------------------------------------------------------------------

describe('TypesenseEngine', () => {
  let engine: TypesenseEngine
  let available = false

  beforeAll(async () => {
    available = await isReachable(`http://${typesenseHost}:${typesensePort}/health`)
    if (!available) return

    engine = new TypesenseEngine(typesenseHost, typesensePort, 'http', typesenseKey)

    // Clean up any leftover collection from a previous run
    try {
      await engine.deleteIndex(INDEX_NAME)
    } catch {
      // Collection may not exist
    }
  })

  afterAll(async () => {
    if (!available) return
    try {
      await engine.deleteIndex(INDEX_NAME)
    } catch {
      // Ignore
    }
  })

  test('skip if Typesense is not available', () => {
    if (!available) {
      console.warn('  ⏭ Typesense not available — skipping')
    }
    expect(true).toBe(true)
  })

  test('createIndex', async () => {
    if (!available) return
    await engine.createIndex(INDEX_NAME, {
      fields: [{ name: '.*', type: 'auto' }],
    })
  })

  test('update — index all products', async () => {
    if (!available) return
    await engine.update(toModels())
    // Typesense indexing is synchronous — no delay needed
  })

  test('search "Apple" returns products 1, 3, 5', async () => {
    if (!available) return
    const result = await engine.search(builder(engine, 'Apple'))
    expectIdsToMatch(result.keys, [1, 3, 5])
  })

  test('search "laptop" returns products 1, 2', async () => {
    if (!available) return
    const result = await engine.search(builder(engine, 'laptop'))
    expectIdsToMatch(result.keys, [1, 2])
  })

  test('search with where filter category = phones', async () => {
    if (!available) return
    const b = builder(engine, '')
    b.where('category', 'phones')
    const result = await engine.search(b)
    expectIdsToMatch(result.keys, [3, 4])
  })

  test('search with whereIn filter category IN [laptops, audio]', async () => {
    if (!available) return
    const b = builder(engine, '')
    b.whereIn('category', ['laptops', 'audio'])
    const result = await engine.search(b)
    expectIdsToMatch(result.keys, [1, 2, 5])
  })

  test('paginate — page 1, perPage 2', async () => {
    if (!available) return
    const b = builder(engine, '')
    const result = await engine.paginate(b, 2, 1)
    expect(result.keys.length).toBe(2)
    expect(result.total).toBeGreaterThanOrEqual(5)
  })

  test('delete — remove product 5, search "Apple" returns 1, 3', async () => {
    if (!available) return
    const product5 = toModels(products.filter((p) => p.id === 5))
    await engine.delete(product5)

    const result = await engine.search(builder(engine, 'Apple'))
    expectIdsToMatch(result.keys, [1, 3])
  })

  test('flush — clear all, search returns 0', async () => {
    if (!available) return
    // Typesense flush deletes the collection, so re-create after
    await engine.flush(INDEX_NAME)
    await engine.createIndex(INDEX_NAME, {
      fields: [{ name: '.*', type: 'auto' }],
    })

    const b = builder(engine, '')
    const result = await engine.search(b)
    expect(result.keys.length).toBe(0)
    expect(result.total).toBe(0)
  })

  test('deleteIndex — cleanup', async () => {
    if (!available) return
    await engine.deleteIndex(INDEX_NAME)
    // Verify collection is gone
    try {
      await engine.search(builder(engine, ''))
    } catch (err: any) {
      expect(err.message).toContain('Typesense')
    }
  })
})

// ---------------------------------------------------------------------------
// Elasticsearch
// ---------------------------------------------------------------------------

describe('ElasticsearchEngine', () => {
  let engine: ElasticsearchEngine
  let available = false

  /** Refresh the index so documents become searchable immediately. */
  async function refreshIndex(): Promise<void> {
    await fetch(`${esHost}/${INDEX_NAME}/_refresh`, { method: 'POST' })
  }

  beforeAll(async () => {
    available = await isReachable(esHost)
    if (!available) return

    engine = new ElasticsearchEngine([esHost])

    // Clean up any leftover index from a previous run
    try {
      await engine.deleteIndex(INDEX_NAME)
    } catch {
      // Index may not exist
    }
  })

  afterAll(async () => {
    if (!available) return
    try {
      await engine.deleteIndex(INDEX_NAME)
    } catch {
      // Ignore
    }
  })

  test('skip if Elasticsearch is not available', () => {
    if (!available) {
      console.warn('  ⏭ Elasticsearch not available — skipping')
    }
    expect(true).toBe(true)
  })

  test('createIndex', async () => {
    if (!available) return
    await engine.createIndex(INDEX_NAME)
  })

  test('update — index all products', async () => {
    if (!available) return
    await engine.update(toModels())
    await refreshIndex()
  })

  test('search "Apple" returns products 1, 3, 5', async () => {
    if (!available) return
    const result = await engine.search(builder(engine, 'Apple'))
    expectIdsToMatch(result.keys, [1, 3, 5])
  })

  test('search "laptop" returns products 1, 2', async () => {
    if (!available) return
    const result = await engine.search(builder(engine, 'laptop'))
    expectIdsToMatch(result.keys, [1, 2])
  })

  test('search with where filter category = phones', async () => {
    if (!available) return
    const b = builder(engine, '')
    b.where('category', 'phones')
    const result = await engine.search(b)
    expectIdsToMatch(result.keys, [3, 4])
  })

  test('search with whereIn filter category IN [laptops, audio]', async () => {
    if (!available) return
    const b = builder(engine, '')
    b.whereIn('category', ['laptops', 'audio'])
    const result = await engine.search(b)
    expectIdsToMatch(result.keys, [1, 2, 5])
  })

  test('paginate — page 1, perPage 2', async () => {
    if (!available) return
    const b = builder(engine, '')
    const result = await engine.paginate(b, 2, 1)
    expect(result.keys.length).toBe(2)
    expect(result.total).toBeGreaterThanOrEqual(5)
  })

  test('delete — remove product 5, search "Apple" returns 1, 3', async () => {
    if (!available) return
    const product5 = toModels(products.filter((p) => p.id === 5))
    await engine.delete(product5)
    await refreshIndex()

    const result = await engine.search(builder(engine, 'Apple'))
    expectIdsToMatch(result.keys, [1, 3])
  })

  test('flush — clear all, search returns 0', async () => {
    if (!available) return
    await engine.flush(INDEX_NAME)
    await refreshIndex()

    const result = await engine.search(builder(engine, ''))
    expect(result.keys.length).toBe(0)
  })

  test('deleteIndex — cleanup', async () => {
    if (!available) return
    await engine.deleteIndex(INDEX_NAME)
    // Verify index is gone
    try {
      await engine.search(builder(engine, ''))
    } catch (err: any) {
      expect(err.message).toContain('Elasticsearch')
    }
  })
})
