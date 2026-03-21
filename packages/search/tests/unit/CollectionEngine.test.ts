import { describe, it, expect, beforeEach } from 'bun:test'
import { CollectionEngine } from '../../src/drivers/CollectionEngine.ts'
import { SearchBuilder } from '../../src/SearchBuilder.ts'

// Minimal model mock
function createModel(id: number, attrs: Record<string, any>) {
  const model = {
    id,
    attributes: { id, ...attrs },
    getAttribute(key: string) { return this.attributes[key] },
    toSearchableArray() { return { ...this.attributes } },
    searchableKey() { return this.id },
    constructor: MockModel,
  }
  return model
}

class MockModel {
  static table = 'posts'
  static primaryKey = 'id'
  static searchableAs() { return 'posts' }
}

describe('CollectionEngine', () => {
  let engine: CollectionEngine

  beforeEach(() => {
    engine = new CollectionEngine()
  })

  it('indexes and searches models', async () => {
    const m1 = createModel(1, { title: 'Hello World', body: 'This is a test' })
    const m2 = createModel(2, { title: 'Goodbye World', body: 'Another test' })

    await engine.update([m1, m2])

    const builder = new SearchBuilder(MockModel, 'hello', engine)
    const result = await engine.search(builder)

    expect(result.keys).toEqual([1])
    expect(result.total).toBe(1)
  })

  it('returns all records for empty query', async () => {
    const m1 = createModel(1, { title: 'First' })
    const m2 = createModel(2, { title: 'Second' })

    await engine.update([m1, m2])

    const builder = new SearchBuilder(MockModel, '', engine)
    const result = await engine.search(builder)

    expect(result.keys.length).toBe(2)
    expect(result.total).toBe(2)
  })

  it('applies where clause', async () => {
    const m1 = createModel(1, { title: 'Post', status: 'published' })
    const m2 = createModel(2, { title: 'Draft', status: 'draft' })

    await engine.update([m1, m2])

    const builder = new SearchBuilder(MockModel, '', engine)
    builder.where('status', 'published')
    const result = await engine.search(builder)

    expect(result.keys).toEqual([1])
  })

  it('applies whereIn clause', async () => {
    const m1 = createModel(1, { title: 'A', category: 'tech' })
    const m2 = createModel(2, { title: 'B', category: 'science' })
    const m3 = createModel(3, { title: 'C', category: 'art' })

    await engine.update([m1, m2, m3])

    const builder = new SearchBuilder(MockModel, '', engine)
    builder.whereIn('category', ['tech', 'art'])
    const result = await engine.search(builder)

    expect(result.keys).toEqual([1, 3])
  })

  it('applies orderBy', async () => {
    const m1 = createModel(1, { title: 'B' })
    const m2 = createModel(2, { title: 'A' })
    const m3 = createModel(3, { title: 'C' })

    await engine.update([m1, m2, m3])

    const builder = new SearchBuilder(MockModel, '', engine)
    builder.orderBy('title', 'asc')
    const result = await engine.search(builder)

    expect(result.keys).toEqual([2, 1, 3])
  })

  it('applies limit and offset', async () => {
    const models = Array.from({ length: 10 }, (_, i) => createModel(i + 1, { title: `Post ${i + 1}` }))
    await engine.update(models)

    const builder = new SearchBuilder(MockModel, '', engine)
    builder.skip(3).take(2)
    const result = await engine.search(builder)

    expect(result.keys).toEqual([4, 5])
    expect(result.total).toBe(10)
  })

  it('paginates results', async () => {
    const models = Array.from({ length: 5 }, (_, i) => createModel(i + 1, { title: `Post ${i + 1}` }))
    await engine.update(models)

    const builder = new SearchBuilder(MockModel, '', engine)
    const page1 = await engine.paginate(builder, 2, 1)
    const page2 = await engine.paginate(builder, 2, 2)

    expect(page1.keys.length).toBe(2)
    expect(page2.keys.length).toBe(2)
    expect(page1.total).toBe(5)
  })

  it('deletes models from index', async () => {
    const m1 = createModel(1, { title: 'Keep' })
    const m2 = createModel(2, { title: 'Remove' })

    await engine.update([m1, m2])
    await engine.delete([m2])

    const builder = new SearchBuilder(MockModel, '', engine)
    const result = await engine.search(builder)

    expect(result.keys).toEqual([1])
  })

  it('flushes entire index', async () => {
    const m1 = createModel(1, { title: 'Post' })
    await engine.update([m1])
    await engine.flush('posts')

    const builder = new SearchBuilder(MockModel, '', engine)
    const result = await engine.search(builder)

    expect(result.keys).toEqual([])
    expect(result.total).toBe(0)
  })
})
