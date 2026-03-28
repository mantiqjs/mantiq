import { describe, it, expect } from 'bun:test'
import { EmbeddingManager } from '../../src/embeddings/EmbeddingManager.ts'
import { AIManager } from '../../src/AIManager.ts'
import { AIFake } from '../../src/testing/AIFake.ts'

describe('EmbeddingManager', () => {
  function setup(opts?: { defaultProvider?: string; defaultModel?: string }) {
    const fake = new AIFake()
    fake.respondWithEmbedding({
      embeddings: [[0.1, 0.2], [0.3, 0.4]],
      model: 'test-model',
      usage: { totalTokens: 10 },
    })

    const manager = new AIManager({ default: 'test', providers: {} })
    manager.extend('test', () => fake)

    const embeddings = new EmbeddingManager(
      manager,
      opts?.defaultProvider,
      opts?.defaultModel,
    )

    return { fake, manager, embeddings }
  }

  // ── embed() ────────────────────────────────────────────────────────────────

  it('embed() delegates to the correct driver', async () => {
    const { fake, embeddings } = setup()
    const result = await embeddings.embed('Hello')

    expect(result.embeddings).toEqual([[0.1, 0.2], [0.3, 0.4]])
    expect(result.model).toBe('test-model')
    fake.assertMethodCalled('embed', 1)
  })

  it('embed() passes options through to driver', async () => {
    const { fake, embeddings } = setup()
    await embeddings.embed('Hello', { model: 'custom-model', dimensions: 256 })

    const embedCalls = fake.sentFor('embed')
    expect(embedCalls).toHaveLength(1)
    expect(embedCalls[0]!.options.model).toBe('custom-model')
    expect(embedCalls[0]!.options.dimensions).toBe(256)
  })

  it('embed() uses defaultModel when no model option given', async () => {
    const { fake, embeddings } = setup({ defaultModel: 'text-embedding-3-small' })
    await embeddings.embed('Hello')

    const embedCalls = fake.sentFor('embed')
    expect(embedCalls[0]!.options.model).toBe('text-embedding-3-small')
  })

  it('embed() explicit model overrides defaultModel', async () => {
    const { fake, embeddings } = setup({ defaultModel: 'text-embedding-3-small' })
    await embeddings.embed('Hello', { model: 'text-embedding-ada-002' })

    const embedCalls = fake.sentFor('embed')
    expect(embedCalls[0]!.options.model).toBe('text-embedding-ada-002')
  })

  it('embed() accepts string array input', async () => {
    const { fake, embeddings } = setup()
    await embeddings.embed(['Hello', 'World'])

    const embedCalls = fake.sentFor('embed')
    expect(embedCalls[0]!.input).toEqual(['Hello', 'World'])
  })

  // ── embedBatch() ───────────────────────────────────────────────────────────

  it('embedBatch() processes inputs in a single batch when under limit', async () => {
    const { fake, embeddings } = setup()
    const inputs = ['A', 'B', 'C']
    const result = await embeddings.embedBatch(inputs, { batchSize: 100 })

    expect(result.embeddings).toEqual([[0.1, 0.2], [0.3, 0.4]])
    expect(result.usage.totalTokens).toBe(10)
    fake.assertMethodCalled('embed', 1)
  })

  it('embedBatch() splits into multiple batches', async () => {
    const fake = new AIFake()
    let callCount = 0
    const manager = new AIManager({ default: 'test', providers: {} })
    manager.extend('test', () => fake)

    // Each embed call returns different embeddings
    fake.respondWithEmbedding({
      embeddings: [[0.1]],
      model: 'batch-model',
      usage: { totalTokens: 5 },
    })

    const embeddings = new EmbeddingManager(manager)
    const inputs = ['A', 'B', 'C', 'D', 'E']
    const result = await embeddings.embedBatch(inputs, { batchSize: 2 })

    // Should make 3 batches: [A,B], [C,D], [E]
    const embedCalls = fake.sentFor('embed')
    expect(embedCalls).toHaveLength(3)

    // Aggregated tokens: 5 * 3 = 15
    expect(result.usage.totalTokens).toBe(15)
    expect(result.model).toBe('batch-model')
  })

  it('embedBatch() defaults to batch size 100', async () => {
    const { fake, embeddings } = setup()
    // With only 3 items and default batch size 100, should be 1 call
    await embeddings.embedBatch(['A', 'B', 'C'])
    fake.assertMethodCalled('embed', 1)
  })

  // ── similarity() ───────────────────────────────────────────────────────────

  it('similarity() returns 1 for identical vectors', () => {
    const { embeddings } = setup()
    const v = [1, 0, 0]
    expect(embeddings.similarity(v, v)).toBeCloseTo(1.0, 5)
  })

  it('similarity() returns 0 for orthogonal vectors', () => {
    const { embeddings } = setup()
    expect(embeddings.similarity([1, 0], [0, 1])).toBeCloseTo(0.0, 5)
  })

  it('similarity() returns -1 for opposite vectors', () => {
    const { embeddings } = setup()
    expect(embeddings.similarity([1, 0], [-1, 0])).toBeCloseTo(-1.0, 5)
  })

  it('similarity() returns 0 for empty vectors', () => {
    const { embeddings } = setup()
    expect(embeddings.similarity([], [])).toBe(0)
  })

  it('similarity() returns 0 for mismatched lengths', () => {
    const { embeddings } = setup()
    expect(embeddings.similarity([1, 2], [1, 2, 3])).toBe(0)
  })

  it('similarity() computes correctly for arbitrary vectors', () => {
    const { embeddings } = setup()
    // cos([1,2,3], [4,5,6]) = (4+10+18) / (sqrt(14) * sqrt(77))
    const expected = 32 / (Math.sqrt(14) * Math.sqrt(77))
    expect(embeddings.similarity([1, 2, 3], [4, 5, 6])).toBeCloseTo(expected, 5)
  })

  it('similarity() returns 0 for zero vectors', () => {
    const { embeddings } = setup()
    expect(embeddings.similarity([0, 0], [1, 2])).toBe(0)
  })
})
