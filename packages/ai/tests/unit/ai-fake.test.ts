import { describe, it, expect } from 'bun:test'
import { AIFake } from '../../src/testing/AIFake.ts'

describe('AIFake', () => {
  it('returns default response', async () => {
    const fake = new AIFake()
    fake.respondWith({ content: 'Hello from fake!' })

    const response = await fake.chat([{ role: 'user', content: 'Hi' }])
    expect(response.content).toBe('Hello from fake!')
    expect(response.role).toBe('assistant')
    expect(response.finishReason).toBe('stop')
  })

  it('returns sequential responses', async () => {
    const fake = new AIFake()
    fake.respondWithSequence([
      { content: 'First' },
      { content: 'Second' },
      { content: 'Third' },
    ])

    const r1 = await fake.chat([{ role: 'user', content: '1' }])
    const r2 = await fake.chat([{ role: 'user', content: '2' }])
    const r3 = await fake.chat([{ role: 'user', content: '3' }])
    expect(r1.content).toBe('First')
    expect(r2.content).toBe('Second')
    expect(r3.content).toBe('Third')
  })

  it('wraps around sequential responses', async () => {
    const fake = new AIFake()
    fake.respondWithSequence([{ content: 'A' }, { content: 'B' }])

    await fake.chat([{ role: 'user', content: '1' }])
    await fake.chat([{ role: 'user', content: '2' }])
    const r3 = await fake.chat([{ role: 'user', content: '3' }])
    expect(r3.content).toBe('A') // wraps
  })

  it('streams chunks from response content', async () => {
    const fake = new AIFake()
    fake.respondWith({ content: 'Hello world test' })

    const chunks: string[] = []
    for await (const chunk of fake.stream([{ role: 'user', content: 'Hi' }])) {
      chunks.push(chunk.delta)
    }
    expect(chunks.join('')).toContain('Hello')
    expect(chunks.join('')).toContain('world')
  })

  it('generates random embeddings', async () => {
    const fake = new AIFake()
    const result = await fake.embed(['Hello', 'World'])
    expect(result.embeddings).toHaveLength(2)
    expect(result.embeddings[0]!.length).toBe(1536)
  })

  it('returns custom embedding response', async () => {
    const fake = new AIFake()
    fake.respondWithEmbedding({
      embeddings: [[0.1, 0.2, 0.3]],
      model: 'test',
      usage: { totalTokens: 5 },
    })

    const result = await fake.embed('test')
    expect(result.embeddings[0]).toEqual([0.1, 0.2, 0.3])
  })

  it('returns custom transcription', async () => {
    const fake = new AIFake()
    fake.respondWithTranscription({ text: 'Hello world' })
    const result = await fake.transcribe(new Uint8Array())
    expect(result.text).toBe('Hello world')
  })

  // ── Assertions ──────────────────────────────────────────────────────

  it('assertSent passes when requests sent', async () => {
    const fake = new AIFake()
    await fake.chat([{ role: 'user', content: 'Hi' }])
    expect(() => fake.assertSent()).not.toThrow()
    expect(() => fake.assertSent(1)).not.toThrow()
  })

  it('assertSent fails with wrong count', async () => {
    const fake = new AIFake()
    await fake.chat([{ role: 'user', content: 'Hi' }])
    expect(() => fake.assertSent(2)).toThrow('Expected 2')
  })

  it('assertSent fails when nothing sent', () => {
    const fake = new AIFake()
    expect(() => fake.assertSent()).toThrow('none were')
  })

  it('assertNotSent passes when nothing sent', () => {
    const fake = new AIFake()
    expect(() => fake.assertNotSent()).not.toThrow()
  })

  it('assertNotSent fails when something sent', async () => {
    const fake = new AIFake()
    await fake.chat([{ role: 'user', content: 'Hi' }])
    expect(() => fake.assertNotSent()).toThrow()
  })

  it('assertModelUsed checks model option', async () => {
    const fake = new AIFake()
    await fake.chat([{ role: 'user', content: 'Hi' }], { model: 'gpt-4o' })
    expect(() => fake.assertModelUsed('gpt-4o')).not.toThrow()
    expect(() => fake.assertModelUsed('claude')).toThrow()
  })

  it('assertSentWith checks predicate', async () => {
    const fake = new AIFake()
    await fake.chat([{ role: 'user', content: 'Hello there' }])
    expect(() => fake.assertSentWith((r) =>
      r.messages?.some((m) => m.content === 'Hello there') ?? false
    )).not.toThrow()
  })

  it('assertMethodCalled tracks methods', async () => {
    const fake = new AIFake()
    await fake.embed('test')
    await fake.embed('test2')
    await fake.chat([{ role: 'user', content: 'Hi' }])

    expect(() => fake.assertMethodCalled('embed', 2)).not.toThrow()
    expect(() => fake.assertMethodCalled('chat', 1)).not.toThrow()
    expect(() => fake.assertMethodCalled('moderate')).toThrow()
  })

  it('sent() returns all requests', async () => {
    const fake = new AIFake()
    await fake.chat([{ role: 'user', content: 'A' }])
    await fake.embed('B')
    expect(fake.sent()).toHaveLength(2)
  })

  it('sentFor() filters by method', async () => {
    const fake = new AIFake()
    await fake.chat([{ role: 'user', content: 'A' }])
    await fake.embed('B')
    await fake.chat([{ role: 'user', content: 'C' }])
    expect(fake.sentFor('chat')).toHaveLength(2)
    expect(fake.sentFor('embed')).toHaveLength(1)
  })

  it('reset clears everything', async () => {
    const fake = new AIFake()
    fake.respondWith({ content: 'test' })
    await fake.chat([{ role: 'user', content: 'Hi' }])
    fake.reset()

    expect(fake.sent()).toHaveLength(0)
    const response = await fake.chat([{ role: 'user', content: 'Hi' }])
    expect(response.content).toBe('') // default response cleared
  })
})
