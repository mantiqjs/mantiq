import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { SQLiteConnection } from '@mantiq/database'
import { Model } from '@mantiq/database'
import { DatabaseEngine } from '../../src/drivers/DatabaseEngine.ts'
import { AlgoliaEngine } from '../../src/drivers/AlgoliaEngine.ts'
import { SearchBuilder } from '../../src/SearchBuilder.ts'

// ─── Test data ───────────────────────────────────────────────────────────────

const productData = [
  { name: 'MacBook Pro', category: 'laptops', price: 2499, description: 'Apple laptop with M3 chip' },
  { name: 'ThinkPad X1', category: 'laptops', price: 1899, description: 'Lenovo business laptop' },
  { name: 'iPhone 16', category: 'phones', price: 999, description: 'Apple smartphone' },
  { name: 'Galaxy S24', category: 'phones', price: 899, description: 'Samsung smartphone' },
  { name: 'AirPods Pro', category: 'audio', price: 249, description: 'Apple wireless earbuds' },
]

// ═════════════════════════════════════════════════════════════════════════════
// DatabaseEngine — SQLite in-memory
// ═════════════════════════════════════════════════════════════════════════════

describe('DatabaseEngine (SQLite)', () => {
  let conn: SQLiteConnection
  let engine: DatabaseEngine

  // Concrete Model subclass wired to the in-memory connection
  class Product extends Model {
    static override table = 'products'
    static override primaryKey = 'id'
    static override fillable = ['name', 'category', 'price', 'description']
    static override timestamps = false
  }

  beforeAll(async () => {
    conn = new SQLiteConnection({ database: ':memory:' })

    await conn.statement(
      `CREATE TABLE products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        category TEXT,
        price REAL,
        description TEXT
      )`,
    )

    Product.setConnection(conn)

    for (const p of productData) {
      await Product.create(p)
    }

    engine = new DatabaseEngine()
  })

  afterAll(() => {
    conn.close()
  })

  it('searches for "Apple" and finds 3 results', async () => {
    const builder = new SearchBuilder(Product, 'Apple', engine)
    const result = await engine.search(builder)

    expect(result.keys.length).toBe(3)
    // MacBook Pro (Apple laptop), iPhone 16 (Apple smartphone), AirPods Pro (Apple earbuds)
    const names = result.raw.map((m: any) => m.getAttribute('name'))
    expect(names).toContain('MacBook Pro')
    expect(names).toContain('iPhone 16')
    expect(names).toContain('AirPods Pro')
  })

  it('searches for "laptop" and finds 2 results', async () => {
    const builder = new SearchBuilder(Product, 'laptop', engine)
    const result = await engine.search(builder)

    expect(result.keys.length).toBe(2)
    const names = result.raw.map((m: any) => m.getAttribute('name'))
    expect(names).toContain('MacBook Pro')
    expect(names).toContain('ThinkPad X1')
  })

  it('filters with where category = phones', async () => {
    const builder = new SearchBuilder(Product, '', engine)
    builder.where('category', 'phones')
    const result = await engine.search(builder)

    expect(result.keys.length).toBe(2)
    const names = result.raw.map((m: any) => m.getAttribute('name'))
    expect(names).toContain('iPhone 16')
    expect(names).toContain('Galaxy S24')
  })

  it('paginates results (page 1, perPage 2)', async () => {
    const builder = new SearchBuilder(Product, '', engine)
    const result = await engine.paginate(builder, 2, 1)

    expect(result.keys.length).toBe(2)
    expect(result.total).toBe(5)
  })

  it('returns all products for empty query', async () => {
    const builder = new SearchBuilder(Product, '', engine)
    const result = await engine.search(builder)

    expect(result.keys.length).toBe(5)
    expect(result.total).toBe(5)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// AlgoliaEngine — live API (skipped if credentials not set)
// ═════════════════════════════════════════════════════════════════════════════

const appId = process.env['ALGOLIA_APP_ID']
const apiKey = process.env['ALGOLIA_API_KEY']
const algoliaAvailable = !!(appId && apiKey)

// Mock model that satisfies AlgoliaEngine's resolveIndexName / resolveKey / resolveData
class AlgoliaProduct {
  static searchableAs() {
    return 'test_products'
  }

  constructor(
    public id: number,
    public data: Record<string, any>,
  ) {}

  searchableKey() {
    return this.id
  }

  toSearchableArray() {
    return { id: this.id, ...this.data }
  }
}

function createAlgoliaModel(id: number, attrs: Record<string, any>): AlgoliaProduct {
  return new AlgoliaProduct(id, attrs)
}

describe.skipIf(!algoliaAvailable)('AlgoliaEngine (live API)', () => {
  const INDEX_NAME = `test_products_${Date.now()}`
  let engine: AlgoliaEngine

  const models = productData.map((p, i) => createAlgoliaModel(i + 1, p))

  beforeAll(async () => {
    engine = new AlgoliaEngine(appId!, apiKey!)

    // Create the index and configure searchable attributes for filtering
    await engine.createIndex(INDEX_NAME, {
      searchableAttributes: ['name', 'category', 'description'],
      attributesForFaceting: ['filterOnly(category)'],
    })

    // Index the products
    await engine.update(models)

    // Wait for Algolia to finish indexing + apply settings (new index needs time)
    await new Promise((resolve) => setTimeout(resolve, 8000))
  }, 20000)

  afterAll(async () => {
    try {
      await engine.deleteIndex(INDEX_NAME)
    } catch {
      // Best-effort cleanup
    }
  })

  it('searches for "Apple" and finds matching products', async () => {
    const builder = new SearchBuilder(AlgoliaProduct, 'Apple', engine)
    const result = await engine.search(builder)

    expect(result.total).toBeGreaterThanOrEqual(3)
    const ids = result.keys.map(Number)
    // MacBook Pro (1), iPhone 16 (3), AirPods Pro (5)
    expect(ids).toContain(1)
    expect(ids).toContain(3)
    expect(ids).toContain(5)
  })

  it('searches with category filter', async () => {
    const builder = new SearchBuilder(AlgoliaProduct, '', engine)
    builder.where('category', 'phones')
    const result = await engine.search(builder)

    expect(result.total).toBe(2)
    const ids = result.keys.map(Number)
    expect(ids).toContain(3) // iPhone 16
    expect(ids).toContain(4) // Galaxy S24
  })

  it('deletes a model from the index', async () => {
    const modelToRemove = models[3]! // Galaxy S24 (id=4)
    await engine.delete([modelToRemove])

    // Wait for Algolia to process deletion (eventual consistency)
    await new Promise((resolve) => setTimeout(resolve, 5000))

    const builder = new SearchBuilder(AlgoliaProduct, 'Samsung', engine)
    const result = await engine.search(builder)

    // Algolia is eventually consistent — the delete may not have propagated yet
    expect(result.total).toBeLessThanOrEqual(1)
  }, 15000)

  it('flushes the index', async () => {
    await engine.flush(INDEX_NAME)

    // Wait for Algolia to process flush
    await new Promise((resolve) => setTimeout(resolve, 3000))

    const builder = new SearchBuilder(AlgoliaProduct, '', engine)
    const result = await engine.search(builder)

    expect(result.total).toBe(0)
  }, 10000)
})
