import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { MeilisearchEngine } from '../../src/drivers/MeilisearchEngine.ts'
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

const INDEX_NAME = 'test_meili_products'

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

function builder(engine: SearchEngine, query: string): SearchBuilder {
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

async function waitForTask(host: string, apiKey: string, taskUid: number, maxMs = 10000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    const res = await fetch(`${host}/tasks/${taskUid}`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    })
    const task = await res.json() as Record<string, any>
    if (task.status === 'succeeded' || task.status === 'failed') return
    await new Promise((r) => setTimeout(r, 250))
  }
}

const meiliHost = process.env.MEILI_HOST ?? 'http://localhost:7700'
const meiliKey = process.env.MEILI_KEY ?? 'testkey'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MeilisearchEngine — extended', () => {
  let engine: MeilisearchEngine
  let available = false

  async function configureIndex(): Promise<void> {
    const res = await fetch(`${meiliHost}/indexes/${INDEX_NAME}/settings`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(meiliKey ? { Authorization: `Bearer ${meiliKey}` } : {}),
      },
      body: JSON.stringify({
        filterableAttributes: ['category', 'price'],
        sortableAttributes: ['name', 'price'],
      }),
    })
    const task = await res.json() as Record<string, any>
    if (task.taskUid != null) await waitForTask(meiliHost, meiliKey, task.taskUid)
  }

  async function indexAndWait(): Promise<void> {
    const res = await fetch(`${meiliHost}/indexes/${INDEX_NAME}/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(meiliKey ? { Authorization: `Bearer ${meiliKey}` } : {}),
      },
      body: JSON.stringify(products),
    })
    const task = await res.json() as Record<string, any>
    if (task.taskUid != null) await waitForTask(meiliHost, meiliKey, task.taskUid)
  }

  beforeAll(async () => {
    available = await isReachable(meiliHost)
    if (!available) return

    engine = new MeilisearchEngine(meiliHost, meiliKey)

    try { await engine.deleteIndex(INDEX_NAME) } catch { /* ignore */ }
    await new Promise((r) => setTimeout(r, 1000))

    await engine.createIndex(INDEX_NAME)
    await new Promise((r) => setTimeout(r, 1000))
    await configureIndex()
    await indexAndWait()
  })

  afterAll(async () => {
    if (!available) return
    try { await engine.deleteIndex(INDEX_NAME) } catch { /* ignore */ }
  })

  test('skip if Meilisearch is not available', () => {
    if (!available) console.warn('  Meilisearch not available — skipping')
    expect(true).toBe(true)
  })

  // ── createIndex / deleteIndex ────────────────────────────────────────

  test('createIndex + deleteIndex round-trip', async () => {
    if (!available) return
    const tempIndex = 'test_meili_temp_idx'
    await engine.createIndex(tempIndex)
    await new Promise((r) => setTimeout(r, 1000))

    // Deleting should not throw
    await engine.deleteIndex(tempIndex)
  })

  // ── index documents, search returns matches ──────────────────────────

  test('search "Apple" returns all Apple products', async () => {
    if (!available) return
    const result = await engine.search(builder(engine, 'Apple'))
    const keys = result.keys.map(Number).sort((a, b) => a - b)
    expect(keys).toContain(1)
    expect(keys).toContain(3)
    expect(keys).toContain(5)
  })

  test('search "laptop" returns laptop products', async () => {
    if (!available) return
    const result = await engine.search(builder(engine, 'laptop'))
    const keys = result.keys.map(Number).sort((a, b) => a - b)
    expect(keys).toContain(1)
    expect(keys).toContain(2)
  })

  // ── filter by field ──────────────────────────────────────────────────

  test('filter by category = audio', async () => {
    if (!available) return
    const b = builder(engine, '')
    b.where('category', 'audio')
    const result = await engine.search(b)
    const keys = result.keys.map(Number).sort((a, b) => a - b)
    expect(keys).toEqual([5, 8])
  })

  test('filter with whereIn categories', async () => {
    if (!available) return
    const b = builder(engine, '')
    b.whereIn('category', ['phones', 'wearables'])
    const result = await engine.search(b)
    const keys = result.keys.map(Number).sort((a, b) => a - b)
    expect(keys).toEqual([3, 4, 6])
  })

  // ── sort by field ────────────────────────────────────────────────────

  test('sort by price ascending', async () => {
    if (!available) return
    const b = builder(engine, '')
    b.orderBy('price', 'asc')
    const result = await engine.search(b)
    const prices = result.raw.hits.map((h: any) => h.price)
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1])
    }
  })

  test('sort by price descending', async () => {
    if (!available) return
    const b = builder(engine, '')
    b.orderBy('price', 'desc')
    const result = await engine.search(b)
    const prices = result.raw.hits.map((h: any) => h.price)
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeLessThanOrEqual(prices[i - 1])
    }
  })

  // ── paginate results ─────────────────────────────────────────────────

  test('paginate page 1 with perPage 3', async () => {
    if (!available) return
    const b = builder(engine, '')
    const result = await engine.paginate(b, 3, 1)
    expect(result.keys.length).toBe(3)
    expect(result.total).toBeGreaterThanOrEqual(8)
  })

  test('paginate page 2 returns different results from page 1', async () => {
    if (!available) return
    const page1 = await engine.paginate(builder(engine, ''), 3, 1)
    const page2 = await engine.paginate(builder(engine, ''), 3, 2)
    expect(page2.keys.length).toBe(3)

    // No overlap
    const overlap = page1.keys.filter((k) => page2.keys.map(String).includes(String(k)))
    expect(overlap.length).toBe(0)
  })

  // ── update document reflected in search ──────────────────────────────

  test('update document reflected in search', async () => {
    if (!available) return
    // Change product 4's description to contain "Apple"
    const updated = new ProductModel({ id: 4, name: 'Galaxy S24', category: 'phones', price: 899, description: 'Apple-compatible phone' })
    await engine.update([updated])
    await new Promise((r) => setTimeout(r, 2000))

    const result = await engine.search(builder(engine, 'Apple'))
    const keys = result.keys.map(Number)
    expect(keys).toContain(4)

    // Restore original
    const restored = new ProductModel(products[3]!)
    await engine.update([restored])
    await new Promise((r) => setTimeout(r, 2000))
  })

  // ── delete document removed from search ──────────────────────────────

  test('delete document removes it from search', async () => {
    if (!available) return
    const target = toModels(products.filter((p) => p.id === 8))
    await engine.delete(target)
    await new Promise((r) => setTimeout(r, 2000))

    const result = await engine.search(builder(engine, 'speaker'))
    const keys = result.keys.map(Number)
    expect(keys).not.toContain(8)

    // Re-add for other tests
    await engine.update(target)
    await new Promise((r) => setTimeout(r, 2000))
  })

  // ── search with typo (fuzzy) ─────────────────────────────────────────

  test('search with typo still finds results (fuzzy)', async () => {
    if (!available) return
    // "Macbok" is a typo for "MacBook"
    const result = await engine.search(builder(engine, 'Macbok'))
    const keys = result.keys.map(Number)
    expect(keys).toContain(1)
  })

  // ── empty search returns all ─────────────────────────────────────────

  test('empty search returns all indexed documents', async () => {
    if (!available) return
    const result = await engine.search(builder(engine, ''))
    expect(result.total).toBeGreaterThanOrEqual(8)
  })

  // ── faceted search via where + search query ──────────────────────────

  test('faceted search: category = laptops AND query "Apple"', async () => {
    if (!available) return
    const b = builder(engine, 'Apple')
    b.where('category', 'laptops')
    const result = await engine.search(b)
    const keys = result.keys.map(Number)
    expect(keys).toEqual([1])
  })
})
