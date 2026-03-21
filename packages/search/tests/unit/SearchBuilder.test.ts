import { describe, it, expect } from 'bun:test'
import { SearchBuilder } from '../../src/SearchBuilder.ts'
import type { SearchEngine, SearchResult } from '../../src/contracts/SearchEngine.ts'

// Minimal mock engine
const mockEngine: SearchEngine = {
  async update() {},
  async delete() {},
  async search(builder: SearchBuilder): Promise<SearchResult> {
    return { raw: [], keys: [], total: 0 }
  },
  async paginate(builder: SearchBuilder, perPage: number, page: number): Promise<SearchResult> {
    return { raw: [], keys: [], total: 0 }
  },
  async flush() {},
  async createIndex() {},
  async deleteIndex() {},
}

class MockModel {
  static table = 'posts'
  static primaryKey = 'id'
}

describe('SearchBuilder', () => {
  it('stores the query string', () => {
    const builder = new SearchBuilder(MockModel, 'hello world', mockEngine)
    expect(builder.query).toBe('hello world')
  })

  it('chains where clauses', () => {
    const builder = new SearchBuilder(MockModel, 'test', mockEngine)
    builder.where('status', 'active').where('type', 'post')

    expect(builder.wheres).toEqual([
      { field: 'status', value: 'active' },
      { field: 'type', value: 'post' },
    ])
  })

  it('chains whereIn clauses', () => {
    const builder = new SearchBuilder(MockModel, 'test', mockEngine)
    builder.whereIn('category', ['tech', 'science'])

    expect(builder.whereIns).toEqual([
      { field: 'category', values: ['tech', 'science'] },
    ])
  })

  it('chains orderBy clauses', () => {
    const builder = new SearchBuilder(MockModel, 'test', mockEngine)
    builder.orderBy('created_at', 'desc').orderBy('title')

    expect(builder.orders).toEqual([
      { column: 'created_at', direction: 'desc' },
      { column: 'title', direction: 'asc' },
    ])
  })

  it('take and limit are aliases', () => {
    const b1 = new SearchBuilder(MockModel, '', mockEngine).take(10)
    const b2 = new SearchBuilder(MockModel, '', mockEngine).limit(10)
    expect(b1.getLimit()).toBe(10)
    expect(b2.getLimit()).toBe(10)
  })

  it('skip and offset are aliases', () => {
    const b1 = new SearchBuilder(MockModel, '', mockEngine).skip(5)
    const b2 = new SearchBuilder(MockModel, '', mockEngine).offset(5)
    expect(b1.getOffset()).toBe(5)
    expect(b2.getOffset()).toBe(5)
  })

  it('returns keys from engine', async () => {
    const engine: SearchEngine = {
      ...mockEngine,
      async search(): Promise<SearchResult> {
        return { raw: [], keys: [1, 2, 3], total: 3 }
      },
    }

    const builder = new SearchBuilder(MockModel, 'test', engine)
    const keys = await builder.keys()
    expect(keys).toEqual([1, 2, 3])
  })

  it('returns count from engine', async () => {
    const engine: SearchEngine = {
      ...mockEngine,
      async search(): Promise<SearchResult> {
        return { raw: [], keys: [1, 2], total: 42 }
      },
    }

    const builder = new SearchBuilder(MockModel, 'test', engine)
    const count = await builder.count()
    expect(count).toBe(42)
  })
})
