/**
 * Integration tests against a real Ollama instance.
 *
 * Requirements:
 *   - Ollama running on localhost:11434
 *   - Models pulled: tinyllama, all-minilm
 *
 * CI: Ollama runs as a service container. Locally: `ollama serve`
 * Skip: Set SKIP_OLLAMA=1 or if Ollama is not reachable.
 */
import { describe, it, expect, beforeAll } from 'bun:test'
import { OllamaDriver } from '../../src/drivers/OllamaDriver.ts'
import { AIManager } from '../../src/AIManager.ts'

const OLLAMA_HOST = process.env['OLLAMA_HOST'] ?? 'http://localhost'
const OLLAMA_PORT = Number(process.env['OLLAMA_PORT'] ?? '11434')
const CHAT_MODEL = process.env['OLLAMA_CHAT_MODEL'] ?? 'tinyllama'
const EMBED_MODEL = process.env['OLLAMA_EMBED_MODEL'] ?? 'all-minilm'

let available = false

beforeAll(async () => {
  if (process.env['SKIP_OLLAMA'] === '1') return

  try {
    const res = await fetch(`${OLLAMA_HOST}:${OLLAMA_PORT}/api/tags`, { signal: AbortSignal.timeout(3000) })
    available = res.ok
  } catch {
    available = false
  }
})

describe('Ollama Integration', () => {
  // ── Chat ─────────────────────────────────────────────────────────────

  it.skipIf(!available)('chat: returns a text response', async () => {
    const driver = new OllamaDriver({ host: OLLAMA_HOST, port: OLLAMA_PORT })
    const response = await driver.chat(
      [{ role: 'user', content: 'Say "hello" and nothing else.' }],
      { model: CHAT_MODEL, temperature: 0 },
    )

    expect(response.content.length).toBeGreaterThan(0)
    expect(response.role).toBe('assistant')
    expect(response.model).toBe(CHAT_MODEL)
    expect(response.usage.totalTokens).toBeGreaterThan(0)
    expect(response.finishReason).toBe('stop')
  }, 30_000)

  it.skipIf(!available)('chat: handles system + user messages', async () => {
    const driver = new OllamaDriver({ host: OLLAMA_HOST, port: OLLAMA_PORT })
    const response = await driver.chat(
      [
        { role: 'system', content: 'You only respond with the word "pong".' },
        { role: 'user', content: 'ping' },
      ],
      { model: CHAT_MODEL, temperature: 0 },
    )

    expect(response.content.toLowerCase()).toContain('pong')
  }, 30_000)

  it.skipIf(!available)('chat: respects maxTokens', async () => {
    const driver = new OllamaDriver({ host: OLLAMA_HOST, port: OLLAMA_PORT })
    const response = await driver.chat(
      [{ role: 'user', content: 'Write a long story about a dragon.' }],
      { model: CHAT_MODEL, maxTokens: 10 },
    )

    // With maxTokens=10, the completion should be short
    expect(response.usage.completionTokens).toBeLessThanOrEqual(15)
  }, 30_000)

  // ── Streaming ────────────────────────────────────────────────────────

  it.skipIf(!available)('stream: yields chunks', async () => {
    const driver = new OllamaDriver({ host: OLLAMA_HOST, port: OLLAMA_PORT })
    const chunks: string[] = []

    for await (const chunk of driver.stream(
      [{ role: 'user', content: 'Count from 1 to 5.' }],
      { model: CHAT_MODEL },
    )) {
      chunks.push(chunk.delta)
    }

    const full = chunks.join('')
    expect(full.length).toBeGreaterThan(0)
    expect(chunks.length).toBeGreaterThan(1) // Should have multiple chunks
  }, 30_000)

  it.skipIf(!available)('stream: final chunk has finishReason', async () => {
    const driver = new OllamaDriver({ host: OLLAMA_HOST, port: OLLAMA_PORT })
    let lastChunk: any = null

    for await (const chunk of driver.stream(
      [{ role: 'user', content: 'Say hi' }],
      { model: CHAT_MODEL, maxTokens: 5 },
    )) {
      lastChunk = chunk
    }

    expect(lastChunk?.finishReason).toBe('stop')
  }, 30_000)

  // ── Embeddings ───────────────────────────────────────────────────────

  it.skipIf(!available)('embed: returns vector for single input', async () => {
    const driver = new OllamaDriver({ host: OLLAMA_HOST, port: OLLAMA_PORT })
    const result = await driver.embed('Hello world', { model: EMBED_MODEL })

    expect(result.embeddings).toHaveLength(1)
    expect(result.embeddings[0]!.length).toBeGreaterThan(0)
    expect(result.model).toBe(EMBED_MODEL)
  }, 30_000)

  it.skipIf(!available)('embed: returns vectors for batch input', async () => {
    const driver = new OllamaDriver({ host: OLLAMA_HOST, port: OLLAMA_PORT })
    const result = await driver.embed(['Hello', 'World', 'Test'], { model: EMBED_MODEL })

    expect(result.embeddings).toHaveLength(3)
    // All embeddings should have the same dimensions
    const dim = result.embeddings[0]!.length
    expect(result.embeddings[1]!.length).toBe(dim)
    expect(result.embeddings[2]!.length).toBe(dim)
  }, 60_000)

  it.skipIf(!available)('embed: similar texts have higher cosine similarity', async () => {
    const driver = new OllamaDriver({ host: OLLAMA_HOST, port: OLLAMA_PORT })
    const result = await driver.embed(
      ['The cat sat on the mat', 'A feline rested on the rug', 'JavaScript is a programming language'],
      { model: EMBED_MODEL },
    )

    const similar = cosine(result.embeddings[0]!, result.embeddings[1]!)
    const different = cosine(result.embeddings[0]!, result.embeddings[2]!)

    // Cat/feline sentences should be more similar than cat/javascript
    expect(similar).toBeGreaterThan(different)
  }, 60_000)

  // ── AIManager integration ────────────────────────────────────────────

  it.skipIf(!available)('AIManager: fluent chat via Ollama', async () => {
    const manager = new AIManager({
      default: 'ollama',
      providers: {
        ollama: { driver: 'ollama', host: OLLAMA_HOST, port: OLLAMA_PORT },
      },
      defaultModel: CHAT_MODEL,
    })

    const response = await manager.chat()
      .system('Respond only with the word "yes".')
      .user('Do you understand?')
      .temperature(0)
      .send()

    expect(response.content.toLowerCase()).toContain('yes')
  }, 30_000)

  // ── Unsupported methods ──────────────────────────────────────────────

  it('throws for unsupported methods', async () => {
    const driver = new OllamaDriver({ host: OLLAMA_HOST, port: OLLAMA_PORT })
    await expect(driver.generateImage('test')).rejects.toThrow()
    await expect(driver.speak('test')).rejects.toThrow()
    await expect(driver.transcribe('test')).rejects.toThrow()
    await expect(driver.moderate('test')).rejects.toThrow()
  })
})

// ── Helpers ──────────────────────────────────────────────────────────────────

function cosine(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!
    normA += a[i]! * a[i]!
    normB += b[i]! * b[i]!
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}
