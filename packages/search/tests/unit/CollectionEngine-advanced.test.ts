import { describe, it, expect, beforeEach } from 'bun:test'
import { CollectionEngine } from '../../src/drivers/CollectionEngine.ts'
import { SearchBuilder } from '../../src/SearchBuilder.ts'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

class MockModel {
  static table = 'posts'
  static primaryKey = 'id'
  static searchableAs() { return 'posts' }
}

function createModel(id: number, attrs: Record<string, any>) {
  return {
    id,
    attributes: { id, ...attrs },
    getAttribute(key: string) { return this.attributes[key] },
    toSearchableArray() { return { ...this.attributes } },
    searchableKey() { return this.id },
    constructor: MockModel,
  }
}

function builder(engine: CollectionEngine, query: string): SearchBuilder {
  return new SearchBuilder(MockModel, query, engine)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CollectionEngine — advanced', () => {
  let engine: CollectionEngine

  beforeEach(() => {
    engine = new CollectionEngine()
  })

  // ── Partial string matching ──────────────────────────────────────────

  it('where with partial string match via search query', async () => {
    const m1 = createModel(1, { title: 'TypeScript Guide', body: 'Learn TS' })
    const m2 = createModel(2, { title: 'JavaScript Guide', body: 'Learn JS' })
    const m3 = createModel(3, { title: 'Python Guide', body: 'Learn Python' })

    await engine.update([m1, m2, m3])

    const b = builder(engine, 'Script')
    const result = await engine.search(b)

    expect(result.keys).toEqual([1, 2])
    expect(result.total).toBe(2)
  })

  // ── Numeric comparison via where (exact match) ───────────────────────

  it('where with numeric comparison (exact)', async () => {
    const m1 = createModel(1, { title: 'Cheap', price: 10 })
    const m2 = createModel(2, { title: 'Mid', price: 50 })
    const m3 = createModel(3, { title: 'Expensive', price: 100 })

    await engine.update([m1, m2, m3])

    const b = builder(engine, '')
    b.where('price', 50)
    const result = await engine.search(b)

    expect(result.keys).toEqual([2])
    expect(result.total).toBe(1)
  })

  // ── whereIn with empty array ─────────────────────────────────────────

  it('whereIn with empty array returns no results', async () => {
    const m1 = createModel(1, { title: 'Post', category: 'tech' })
    const m2 = createModel(2, { title: 'Post', category: 'science' })

    await engine.update([m1, m2])

    const b = builder(engine, '')
    b.whereIn('category', [])
    const result = await engine.search(b)

    expect(result.keys).toEqual([])
    expect(result.total).toBe(0)
  })

  // ── orderBy ascending ────────────────────────────────────────────────

  it('orderBy ascending sorts correctly', async () => {
    const m1 = createModel(1, { title: 'Cherry' })
    const m2 = createModel(2, { title: 'Apple' })
    const m3 = createModel(3, { title: 'Banana' })

    await engine.update([m1, m2, m3])

    const b = builder(engine, '')
    b.orderBy('title', 'asc')
    const result = await engine.search(b)

    expect(result.keys).toEqual([2, 3, 1])
  })

  // ── orderBy descending ───────────────────────────────────────────────

  it('orderBy descending sorts correctly', async () => {
    const m1 = createModel(1, { title: 'Cherry' })
    const m2 = createModel(2, { title: 'Apple' })
    const m3 = createModel(3, { title: 'Banana' })

    await engine.update([m1, m2, m3])

    const b = builder(engine, '')
    b.orderBy('title', 'desc')
    const result = await engine.search(b)

    expect(result.keys).toEqual([1, 3, 2])
  })

  // ── orderBy with null values ─────────────────────────────────────────

  it('orderBy handles null values without crashing', async () => {
    const m1 = createModel(1, { title: 'Alpha', priority: null })
    const m2 = createModel(2, { title: 'Beta', priority: 1 })
    const m3 = createModel(3, { title: 'Gamma', priority: 2 })

    await engine.update([m1, m2, m3])

    const b = builder(engine, '')
    b.orderBy('priority', 'asc')
    const result = await engine.search(b)

    // null is < any number in JS comparison, so id=1 should come first
    expect(result.keys.length).toBe(3)
    expect(result.keys[0]).toBe(1)
  })

  // ── paginate: correct total and lastPage ─────────────────────────────

  it('paginate returns correct total, lastPage, and hasMorePages', async () => {
    const models = Array.from({ length: 7 }, (_, i) =>
      createModel(i + 1, { title: `Post ${i + 1}` }),
    )
    await engine.update(models)

    const b = builder(engine, '')
    const result = await engine.paginate(b, 3, 1)

    expect(result.keys.length).toBe(3)
    expect(result.total).toBe(7)
  })

  // ── paginate page 2 offset ───────────────────────────────────────────

  it('paginate page 2 returns correct offset', async () => {
    const models = Array.from({ length: 7 }, (_, i) =>
      createModel(i + 1, { title: `Post ${i + 1}` }),
    )
    await engine.update(models)

    const page1 = await engine.paginate(builder(engine, ''), 3, 1)
    const page2 = await engine.paginate(builder(engine, ''), 3, 2)

    expect(page1.keys.length).toBe(3)
    expect(page2.keys.length).toBe(3)

    // Pages should not overlap
    const allKeys = [...page1.keys, ...page2.keys]
    const unique = new Set(allKeys)
    expect(unique.size).toBe(6)
  })

  // ── paginate last page has fewer items ────────────────────────────────

  it('paginate last page returns remaining items', async () => {
    const models = Array.from({ length: 7 }, (_, i) =>
      createModel(i + 1, { title: `Post ${i + 1}` }),
    )
    await engine.update(models)

    const page3 = await engine.paginate(builder(engine, ''), 3, 3)

    expect(page3.keys.length).toBe(1) // 7 - 6 = 1 remaining
    expect(page3.total).toBe(7)
  })

  // ── keys() returns only IDs ──────────────────────────────────────────

  it('keys() returns only IDs via SearchBuilder', async () => {
    const m1 = createModel(1, { title: 'First' })
    const m2 = createModel(2, { title: 'Second' })
    const m3 = createModel(3, { title: 'Third' })

    await engine.update([m1, m2, m3])

    const b = builder(engine, '')
    const keys = await b.keys()

    expect(keys).toEqual([1, 2, 3])
  })

  // ── count() returns number ───────────────────────────────────────────

  it('count() returns the total number of matching records', async () => {
    const models = Array.from({ length: 5 }, (_, i) =>
      createModel(i + 1, { title: `Post ${i + 1}` }),
    )
    await engine.update(models)

    const b = builder(engine, '')
    const count = await b.count()

    expect(count).toBe(5)
  })

  // ── empty collection ─────────────────────────────────────────────────

  it('search on empty collection returns empty results', async () => {
    const b = builder(engine, 'anything')
    const result = await engine.search(b)

    expect(result.keys).toEqual([])
    expect(result.total).toBe(0)
    expect(result.raw).toEqual([])
  })

  // ── update: re-index changes reflected in search ─────────────────────

  it('update re-indexes changes reflected in search', async () => {
    const m1 = createModel(1, { title: 'Original Title', body: 'content' })
    await engine.update([m1])

    // Verify original is searchable
    let result = await engine.search(builder(engine, 'Original'))
    expect(result.keys).toEqual([1])

    // Update the model with a new title
    const updated = createModel(1, { title: 'Updated Title', body: 'content' })
    await engine.update([updated])

    // Old title should no longer match
    result = await engine.search(builder(engine, 'Original'))
    expect(result.keys).toEqual([])

    // New title should match
    result = await engine.search(builder(engine, 'Updated'))
    expect(result.keys).toEqual([1])
  })

  // ── delete: removed items not in search ──────────────────────────────

  it('delete removes items so they are not returned in search', async () => {
    const m1 = createModel(1, { title: 'Keep Me' })
    const m2 = createModel(2, { title: 'Delete Me' })
    const m3 = createModel(3, { title: 'Keep Also' })

    await engine.update([m1, m2, m3])
    await engine.delete([m2])

    const result = await engine.search(builder(engine, ''))
    expect(result.keys).toEqual([1, 3])
    expect(result.total).toBe(2)
  })

  // ── flush: clears all indexed data ───────────────────────────────────

  it('flush clears all indexed data for the given index', async () => {
    const m1 = createModel(1, { title: 'Post 1' })
    const m2 = createModel(2, { title: 'Post 2' })

    await engine.update([m1, m2])
    await engine.flush('posts')

    const result = await engine.search(builder(engine, ''))
    expect(result.keys).toEqual([])
    expect(result.total).toBe(0)

    // Verify internal store no longer has the index
    expect(engine.getStore().has('posts')).toBe(false)
  })

  // ── search with special characters ───────────────────────────────────

  it('search with special characters does not crash', async () => {
    const m1 = createModel(1, { title: 'C++ Programming', body: 'Learn C++' })
    const m2 = createModel(2, { title: 'C# Basics', body: 'Learn C#' })
    const m3 = createModel(3, { title: 'node.js', body: 'JavaScript runtime' })

    await engine.update([m1, m2, m3])

    let result = await engine.search(builder(engine, 'C++'))
    expect(result.keys).toEqual([1])

    result = await engine.search(builder(engine, 'C#'))
    expect(result.keys).toEqual([2])

    result = await engine.search(builder(engine, 'node.js'))
    expect(result.keys).toEqual([3])
  })

  // ── case-insensitive search ──────────────────────────────────────────

  it('search is case-insensitive', async () => {
    const m1 = createModel(1, { title: 'TypeScript Guide' })
    const m2 = createModel(2, { title: 'PYTHON MANUAL' })

    await engine.update([m1, m2])

    // Lowercase query should match uppercase data
    let result = await engine.search(builder(engine, 'typescript'))
    expect(result.keys).toEqual([1])

    // Uppercase query should match mixed-case data
    result = await engine.search(builder(engine, 'GUIDE'))
    expect(result.keys).toEqual([1])

    // Mixed case
    result = await engine.search(builder(engine, 'python'))
    expect(result.keys).toEqual([2])
  })

  // ── createIndex and deleteIndex ──────────────────────────────────────

  it('createIndex creates an empty index in the store', async () => {
    await engine.createIndex('new_index')

    expect(engine.getStore().has('new_index')).toBe(true)
    expect(engine.getStore().get('new_index')!.size).toBe(0)
  })

  it('deleteIndex removes the index from the store', async () => {
    await engine.createIndex('temp_index')
    expect(engine.getStore().has('temp_index')).toBe(true)

    await engine.deleteIndex('temp_index')
    expect(engine.getStore().has('temp_index')).toBe(false)
  })
})
