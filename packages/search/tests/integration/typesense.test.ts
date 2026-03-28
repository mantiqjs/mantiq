import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { TypesenseEngine } from '../../src/drivers/TypesenseEngine.ts'
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

const INDEX_NAME = 'test_ts_products'

const SCHEMA_FIELDS = [
  { name: 'id', type: 'string' },
  { name: 'name', type: 'string' },
  { name: 'category', type: 'string', facet: true },
  { name: 'price', type: 'float' },
  { name: 'description', type: 'string' },
]

const mockModel = {
  searchableAs: () => INDEX_NAME,
  searchableColumns: () => ['name', 'category', 'description'],
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

function tsBuilder(engine: SearchEngine, query: string): SearchBuilder {
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

const typesenseHost = process.env.TYPESENSE_HOST ?? 'localhost'
const typesensePort = Number(process.env.TYPESENSE_PORT ?? 8108)
const typesenseKey = process.env.TYPESENSE_KEY ?? 'testkey'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TypesenseEngine — extended', () => {
  let engine: TypesenseEngine
  let available = false

  beforeAll(async () => {
    available = await isReachable(`http://${typesenseHost}:${typesensePort}/health`)
    if (!available) return

    engine = new TypesenseEngine(typesenseHost, typesensePort, 'http', typesenseKey)

    try { await engine.deleteIndex(INDEX_NAME) } catch { /* ignore */ }

    await engine.createIndex(INDEX_NAME, { fields: SCHEMA_FIELDS })
    await engine.update(toModels())
  })

  afterAll(async () => {
    if (!available) return
    try { await engine.deleteIndex(INDEX_NAME) } catch { /* ignore */ }
  })

  test('skip if Typesense is not available', () => {
    if (!available) console.warn('  Typesense not available — skipping')
    expect(true).toBe(true)
  })

  // ── createIndex with schema fields ───────────────────────────────────

  test('createIndex with explicit schema fields', async () => {
    if (!available) return
    const tempCollection = 'test_ts_temp_schema'
    await engine.createIndex(tempCollection, {
      fields: [
        { name: 'id', type: 'string' },
        { name: 'title', type: 'string' },
        { name: 'score', type: 'int32' },
      ],
    })
    // Clean up
    await engine.deleteIndex(tempCollection)
  })

  // ── index documents ──────────────────────────────────────────────────

  test('index documents via update', async () => {
    if (!available) return
    // Search for all — should find at least 8
    const result = await engine.search(tsBuilder(engine, ''))
    expect(result.total).toBeGreaterThanOrEqual(8)
  })

  // ── search with query ────────────────────────────────────────────────

  test('search "Apple" returns correct products', async () => {
    if (!available) return
    const result = await engine.search(tsBuilder(engine, 'Apple'))
    const keys = result.keys.map(Number).sort((a, b) => a - b)
    expect(keys).toContain(1)
    expect(keys).toContain(3)
    expect(keys).toContain(5)
  })

  test('search "laptop" matches descriptions and names', async () => {
    if (!available) return
    const result = await engine.search(tsBuilder(engine, 'laptop'))
    const keys = result.keys.map(Number).sort((a, b) => a - b)
    expect(keys).toContain(1)
    expect(keys).toContain(2)
  })

  // ── filter by string field ───────────────────────────────────────────

  test('filter by string field: category = phones', async () => {
    if (!available) return
    const b = tsBuilder(engine, '')
    b.where('category', 'phones')
    const result = await engine.search(b)
    const keys = result.keys.map(Number).sort((a, b) => a - b)
    expect(keys).toEqual([3, 4])
  })

  // ── filter by numeric field ──────────────────────────────────────────

  test('filter by numeric field: price = 249', async () => {
    if (!available) return
    const b = tsBuilder(engine, '')
    b.where('price', 249)
    const result = await engine.search(b)
    const keys = result.keys.map(Number)
    expect(keys).toContain(5)
  })

  // ── filter with whereIn ──────────────────────────────────────────────

  test('filter with whereIn categories', async () => {
    if (!available) return
    const b = tsBuilder(engine, '')
    b.whereIn('category', ['audio', 'wearables'])
    const result = await engine.search(b)
    const keys = result.keys.map(Number).sort((a, b) => a - b)
    expect(keys).toEqual([5, 6, 8])
  })

  // ── sort ─────────────────────────────────────────────────────────────

  test('sort by price ascending', async () => {
    if (!available) return
    const b = tsBuilder(engine, '')
    b.orderBy('price', 'asc')
    const result = await engine.search(b)
    const prices = result.raw.hits.map((h: any) => h.document.price)
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1])
    }
  })

  test('sort by price descending', async () => {
    if (!available) return
    const b = tsBuilder(engine, '')
    b.orderBy('price', 'desc')
    const result = await engine.search(b)
    const prices = result.raw.hits.map((h: any) => h.document.price)
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeLessThanOrEqual(prices[i - 1])
    }
  })

  // ── paginate ─────────────────────────────────────────────────────────

  test('paginate page 1 with perPage 3', async () => {
    if (!available) return
    const b = tsBuilder(engine, '')
    const result = await engine.paginate(b, 3, 1)
    expect(result.keys.length).toBe(3)
    expect(result.total).toBeGreaterThanOrEqual(8)
  })

  test('paginate page 2 returns different results', async () => {
    if (!available) return
    const page1 = await engine.paginate(tsBuilder(engine, ''), 3, 1)
    const page2 = await engine.paginate(tsBuilder(engine, ''), 3, 2)
    expect(page2.keys.length).toBe(3)

    const overlap = page1.keys.filter((k) => page2.keys.map(String).includes(String(k)))
    expect(overlap.length).toBe(0)
  })

  // ── delete collection ────────────────────────────────────────────────

  test('deleteIndex removes the collection', async () => {
    if (!available) return
    const tempName = 'test_ts_delete_me'
    await engine.createIndex(tempName, {
      fields: [{ name: 'id', type: 'string' }, { name: 'name', type: 'string' }],
    })
    await engine.deleteIndex(tempName)

    // Searching the deleted collection should throw
    try {
      await engine.search(new SearchBuilder({ searchableAs: () => tempName, searchableColumns: () => ['name'] }, '', engine))
      expect(true).toBe(false) // Should not reach here
    } catch (err: any) {
      expect(err.message).toContain('Typesense')
    }
  })

  // ── update document ──────────────────────────────────────────────────

  test('update document reflected in search', async () => {
    if (!available) return
    // Update product 4's name to include "Apple"
    const updated = new ProductModel({ id: 4, name: 'Apple Galaxy S24', category: 'phones', price: 899, description: 'Samsung smartphone' })
    await engine.update([updated])

    const result = await engine.search(tsBuilder(engine, 'Apple Galaxy'))
    const keys = result.keys.map(Number)
    expect(keys).toContain(4)

    // Restore original
    const restored = new ProductModel(products[3]!)
    await engine.update([restored])
  })

  // ── combined filter + query ──────────────────────────────────────────

  test('combined filter and query: category = laptops AND "Apple"', async () => {
    if (!available) return
    const b = tsBuilder(engine, 'Apple')
    b.where('category', 'laptops')
    const result = await engine.search(b)
    const keys = result.keys.map(Number)
    expect(keys).toContain(1)
    expect(keys).not.toContain(3) // iPhone is phones, not laptops
  })
})
