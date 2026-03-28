import { describe, it, expect } from 'bun:test'
import { InMemoryVectorStore } from '../../src/vectorStores/InMemoryVectorStore.ts'

describe('InMemoryVectorStore', () => {
  const makeDoc = (id: string, content: string, embedding: number[], metadata: Record<string, any> = {}) =>
    ({ id, content, embedding, metadata })

  it('upserts and counts documents', async () => {
    const store = new InMemoryVectorStore()
    await store.upsert([
      makeDoc('1', 'Hello', [1, 0, 0]),
      makeDoc('2', 'World', [0, 1, 0]),
    ])
    expect(await store.count()).toBe(2)
  })

  it('overwrites documents with same id', async () => {
    const store = new InMemoryVectorStore()
    await store.upsert([makeDoc('1', 'Old', [1, 0, 0])])
    await store.upsert([makeDoc('1', 'New', [1, 0, 0])])
    expect(await store.count()).toBe(1)
  })

  it('searches by cosine similarity', async () => {
    const store = new InMemoryVectorStore()
    await store.upsert([
      makeDoc('1', 'Similar', [1, 0, 0]),
      makeDoc('2', 'Different', [0, 1, 0]),
      makeDoc('3', 'Also similar', [0.9, 0.1, 0]),
    ])

    const results = await store.search([1, 0, 0], { limit: 2 })
    expect(results).toHaveLength(2)
    expect(results[0]!.id).toBe('1') // exact match first
    expect(results[0]!.score).toBeCloseTo(1.0)
    expect(results[1]!.id).toBe('3') // close second
  })

  it('respects limit', async () => {
    const store = new InMemoryVectorStore()
    await store.upsert([
      makeDoc('1', 'A', [1, 0]),
      makeDoc('2', 'B', [0.9, 0.1]),
      makeDoc('3', 'C', [0.8, 0.2]),
    ])
    const results = await store.search([1, 0], { limit: 1 })
    expect(results).toHaveLength(1)
  })

  it('filters by minScore', async () => {
    const store = new InMemoryVectorStore()
    await store.upsert([
      makeDoc('1', 'Close', [1, 0]),
      makeDoc('2', 'Far', [0, 1]),
    ])
    const results = await store.search([1, 0], { minScore: 0.9 })
    expect(results).toHaveLength(1)
    expect(results[0]!.id).toBe('1')
  })

  it('filters by metadata', async () => {
    const store = new InMemoryVectorStore()
    await store.upsert([
      makeDoc('1', 'Doc A', [1, 0], { source: 'web' }),
      makeDoc('2', 'Doc B', [0.9, 0.1], { source: 'file' }),
      makeDoc('3', 'Doc C', [0.8, 0.2], { source: 'web' }),
    ])
    const results = await store.search([1, 0], { filter: { source: 'file' } })
    expect(results).toHaveLength(1)
    expect(results[0]!.id).toBe('2')
  })

  it('deletes documents', async () => {
    const store = new InMemoryVectorStore()
    await store.upsert([
      makeDoc('1', 'A', [1, 0]),
      makeDoc('2', 'B', [0, 1]),
    ])
    await store.delete(['1'])
    expect(await store.count()).toBe(1)
    const results = await store.search([1, 0])
    expect(results[0]!.id).toBe('2')
  })

  it('handles empty store search', async () => {
    const store = new InMemoryVectorStore()
    const results = await store.search([1, 0, 0])
    expect(results).toEqual([])
  })

  it('returns correct metadata in results', async () => {
    const store = new InMemoryVectorStore()
    await store.upsert([makeDoc('1', 'Test', [1, 0], { page: 5, source: 'manual' })])
    const results = await store.search([1, 0])
    expect(results[0]!.metadata).toEqual({ page: 5, source: 'manual' })
    expect(results[0]!.content).toBe('Test')
  })
})
