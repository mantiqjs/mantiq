import { describe, it, expect } from 'bun:test'
import { PgVectorStore } from '../../src/vectorStores/PgVectorStore.ts'
import type { QueryExecutor } from '../../src/vectorStores/PgVectorStore.ts'

/**
 * Mock QueryExecutor that records all queries and returns configurable results.
 */
class MockQueryExecutor implements QueryExecutor {
  readonly queries: { sql: string; params?: any[] }[] = []
  private results: { rows: any[] }[] = []

  /** Queue a result to be returned by the next query() call. */
  willReturn(rows: any[]): this {
    this.results.push({ rows })
    return this
  }

  async query(sql: string, params?: any[]): Promise<{ rows: any[] }> {
    this.queries.push({ sql, params })
    return this.results.shift() ?? { rows: [] }
  }

  /** Get the last SQL query that was executed. */
  lastQuery(): { sql: string; params?: any[] } | undefined {
    return this.queries[this.queries.length - 1]
  }

  /** Find queries matching a substring. */
  queriesMatching(substr: string): { sql: string; params?: any[] }[] {
    return this.queries.filter((q) => q.sql.includes(substr))
  }

  /** Reset recorded queries and queued results. */
  reset(): void {
    this.queries.length = 0
    this.results.length = 0
  }
}

describe('PgVectorStore', () => {
  const makeStore = (executor: MockQueryExecutor, options?: { table?: string; dimensions?: number }) =>
    new PgVectorStore({ executor, table: options?.table, dimensions: options?.dimensions })

  it('creates the extension and table on first operation', async () => {
    const executor = new MockQueryExecutor()
    executor.willReturn([]) // CREATE EXTENSION
    executor.willReturn([]) // CREATE TABLE
    executor.willReturn([{ count: 0 }]) // COUNT query

    const store = makeStore(executor)
    await store.count()

    const extensionQuery = executor.queriesMatching('CREATE EXTENSION')
    expect(extensionQuery).toHaveLength(1)
    expect(extensionQuery[0]!.sql).toContain('vector')

    const tableQuery = executor.queriesMatching('CREATE TABLE')
    expect(tableQuery).toHaveLength(1)
    expect(tableQuery[0]!.sql).toContain('vector_documents')
    expect(tableQuery[0]!.sql).toContain('vector(1536)')
  })

  it('uses custom table name and dimensions', async () => {
    const executor = new MockQueryExecutor()
    executor.willReturn([]) // CREATE EXTENSION
    executor.willReturn([]) // CREATE TABLE
    executor.willReturn([{ count: 0 }]) // COUNT

    const store = makeStore(executor, { table: 'my_embeddings', dimensions: 768 })
    await store.count()

    const tableQuery = executor.queriesMatching('CREATE TABLE')
    expect(tableQuery[0]!.sql).toContain('my_embeddings')
    expect(tableQuery[0]!.sql).toContain('vector(768)')
  })

  it('only initializes the table once', async () => {
    const executor = new MockQueryExecutor()
    // First call: extension + table + count
    executor.willReturn([])
    executor.willReturn([])
    executor.willReturn([{ count: 0 }])
    // Second call: just count (no extension/table creation)
    executor.willReturn([{ count: 0 }])

    const store = makeStore(executor)
    await store.count()
    await store.count()

    const extensionQueries = executor.queriesMatching('CREATE EXTENSION')
    expect(extensionQueries).toHaveLength(1)
  })

  it('upserts documents with INSERT ON CONFLICT', async () => {
    const executor = new MockQueryExecutor()
    executor.willReturn([]) // CREATE EXTENSION
    executor.willReturn([]) // CREATE TABLE
    executor.willReturn([]) // INSERT

    const store = makeStore(executor)
    await store.upsert([{
      id: 'doc-1',
      content: 'Hello world',
      embedding: [0.1, 0.2, 0.3],
      metadata: { source: 'test' },
    }])

    const insertQuery = executor.queriesMatching('INSERT INTO')
    expect(insertQuery).toHaveLength(1)
    expect(insertQuery[0]!.sql).toContain('ON CONFLICT')
    expect(insertQuery[0]!.sql).toContain('DO UPDATE')
    expect(insertQuery[0]!.params).toEqual([
      'doc-1',
      'Hello world',
      '[0.1,0.2,0.3]',
      '{"source":"test"}',
    ])
  })

  it('upserts multiple documents individually', async () => {
    const executor = new MockQueryExecutor()
    executor.willReturn([]) // CREATE EXTENSION
    executor.willReturn([]) // CREATE TABLE
    executor.willReturn([]) // INSERT 1
    executor.willReturn([]) // INSERT 2

    const store = makeStore(executor)
    await store.upsert([
      { id: '1', content: 'A', embedding: [1, 0], metadata: {} },
      { id: '2', content: 'B', embedding: [0, 1], metadata: {} },
    ])

    const insertQueries = executor.queriesMatching('INSERT INTO')
    expect(insertQueries).toHaveLength(2)
  })

  it('searches using cosine distance operator', async () => {
    const executor = new MockQueryExecutor()
    executor.willReturn([]) // CREATE EXTENSION
    executor.willReturn([]) // CREATE TABLE
    executor.willReturn([
      { id: 'doc-1', content: 'Hello', score: 0.95, metadata: { page: 1 } },
      { id: 'doc-2', content: 'World', score: 0.80, metadata: { page: 2 } },
    ])

    const store = makeStore(executor)
    const results = await store.search([0.1, 0.2, 0.3], { limit: 5 })

    const searchQuery = executor.queriesMatching('<=>')
    expect(searchQuery).toHaveLength(1)
    expect(searchQuery[0]!.params).toEqual(['[0.1,0.2,0.3]', 5])

    expect(results).toHaveLength(2)
    expect(results[0]!.id).toBe('doc-1')
    expect(results[0]!.score).toBe(0.95)
    expect(results[0]!.content).toBe('Hello')
    expect(results[0]!.metadata).toEqual({ page: 1 })
  })

  it('filters by minScore', async () => {
    const executor = new MockQueryExecutor()
    executor.willReturn([]) // CREATE EXTENSION
    executor.willReturn([]) // CREATE TABLE
    executor.willReturn([
      { id: '1', content: 'A', score: 0.95, metadata: {} },
      { id: '2', content: 'B', score: 0.5, metadata: {} },
      { id: '3', content: 'C', score: 0.3, metadata: {} },
    ])

    const store = makeStore(executor)
    const results = await store.search([1, 0], { minScore: 0.8 })

    expect(results).toHaveLength(1)
    expect(results[0]!.id).toBe('1')
  })

  it('applies metadata filter to search query', async () => {
    const executor = new MockQueryExecutor()
    executor.willReturn([]) // CREATE EXTENSION
    executor.willReturn([]) // CREATE TABLE
    executor.willReturn([
      { id: '1', content: 'Match', score: 0.9, metadata: { source: 'web' } },
    ])

    const store = makeStore(executor)
    await store.search([1, 0], { filter: { source: 'web' } })

    const searchQuery = executor.queriesMatching('<=>')
    expect(searchQuery[0]!.sql).toContain('metadata')
    expect(searchQuery[0]!.params).toContain('source')
    expect(searchQuery[0]!.params).toContain('web')
  })

  it('deletes documents by id', async () => {
    const executor = new MockQueryExecutor()
    executor.willReturn([]) // CREATE EXTENSION
    executor.willReturn([]) // CREATE TABLE
    executor.willReturn([]) // DELETE

    const store = makeStore(executor)
    await store.delete(['doc-1', 'doc-2'])

    const deleteQuery = executor.queriesMatching('DELETE')
    expect(deleteQuery).toHaveLength(1)
    expect(deleteQuery[0]!.sql).toContain('IN')
    expect(deleteQuery[0]!.params).toEqual(['doc-1', 'doc-2'])
  })

  it('skips delete when ids array is empty', async () => {
    const executor = new MockQueryExecutor()
    const store = makeStore(executor)
    await store.delete([])

    expect(executor.queriesMatching('DELETE')).toHaveLength(0)
  })

  it('returns count from query', async () => {
    const executor = new MockQueryExecutor()
    executor.willReturn([]) // CREATE EXTENSION
    executor.willReturn([]) // CREATE TABLE
    executor.willReturn([{ count: 42 }])

    const store = makeStore(executor)
    const count = await store.count()

    expect(count).toBe(42)
  })

  it('parses stringified metadata', async () => {
    const executor = new MockQueryExecutor()
    executor.willReturn([]) // CREATE EXTENSION
    executor.willReturn([]) // CREATE TABLE
    executor.willReturn([
      { id: '1', content: 'Test', score: 0.9, metadata: '{"key":"value"}' },
    ])

    const store = makeStore(executor)
    const results = await store.search([1, 0])

    expect(results[0]!.metadata).toEqual({ key: 'value' })
  })

  it('defaults to limit 10 when not specified', async () => {
    const executor = new MockQueryExecutor()
    executor.willReturn([]) // CREATE EXTENSION
    executor.willReturn([]) // CREATE TABLE
    executor.willReturn([])

    const store = makeStore(executor)
    await store.search([1, 0])

    const searchQuery = executor.queriesMatching('LIMIT')
    expect(searchQuery[0]!.params![1]).toBe(10)
  })
})
