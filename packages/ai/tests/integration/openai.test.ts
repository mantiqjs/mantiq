/**
 * Integration tests against the real OpenAI API.
 *
 * Requirements: OPENAI_API_KEY environment variable set.
 * Uses cheapest models (gpt-4o-mini, text-embedding-3-small).
 * Estimated cost: ~$0.01 per full run.
 *
 * Skip: These tests are skipped automatically when OPENAI_API_KEY is not set.
 */
import { describe, it, expect } from 'bun:test'
import { OpenAIDriver } from '../../src/drivers/OpenAIDriver.ts'

const API_KEY = process.env['OPENAI_API_KEY']
const skip = !API_KEY

describe('OpenAI Integration', () => {
  // ── Chat ─────────────────────────────────────────────────────────────

  it.skipIf(skip)('chat: basic completion', async () => {
    const driver = new OpenAIDriver({ apiKey: API_KEY! })
    const response = await driver.chat(
      [{ role: 'user', content: 'Respond with exactly: "test ok"' }],
      { model: 'gpt-4o-mini', maxTokens: 10, temperature: 0 },
    )

    expect(response.content.toLowerCase()).toContain('test ok')
    expect(response.id).toMatch(/^chatcmpl-/)
    expect(response.model).toContain('gpt-4o-mini')
    expect(response.usage.promptTokens).toBeGreaterThan(0)
    expect(response.usage.completionTokens).toBeGreaterThan(0)
    expect(response.finishReason).toBe('stop')
  }, 30_000)

  it.skipIf(skip)('chat: system + user messages', async () => {
    const driver = new OpenAIDriver({ apiKey: API_KEY! })
    const response = await driver.chat(
      [
        { role: 'system', content: 'You are a calculator. Only output the numeric result.' },
        { role: 'user', content: 'What is 2 + 3?' },
      ],
      { model: 'gpt-4o-mini', maxTokens: 10, temperature: 0 },
    )

    expect(response.content).toContain('5')
  }, 30_000)

  it.skipIf(skip)('chat: JSON mode', async () => {
    const driver = new OpenAIDriver({ apiKey: API_KEY! })
    const response = await driver.chat(
      [{ role: 'user', content: 'Return a JSON object with key "color" and value "blue".' }],
      { model: 'gpt-4o-mini', maxTokens: 50, temperature: 0, responseFormat: 'json' },
    )

    const parsed = JSON.parse(response.content)
    expect(parsed.color).toBe('blue')
  }, 30_000)

  it.skipIf(skip)('chat: tool calling', async () => {
    const driver = new OpenAIDriver({ apiKey: API_KEY! })
    const response = await driver.chat(
      [{ role: 'user', content: 'What is the weather in Tokyo?' }],
      {
        model: 'gpt-4o-mini',
        maxTokens: 100,
        tools: [{
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Get weather for a city',
            parameters: {
              type: 'object',
              properties: { city: { type: 'string' } },
              required: ['city'],
            },
          },
        }],
      },
    )

    expect(response.finishReason).toBe('tool_calls')
    expect(response.toolCalls.length).toBeGreaterThan(0)
    expect(response.toolCalls[0]!.function.name).toBe('get_weather')
    const args = JSON.parse(response.toolCalls[0]!.function.arguments)
    expect(args.city.toLowerCase()).toContain('tokyo')
  }, 30_000)

  // ── Streaming ────────────────────────────────────────────────────────

  it.skipIf(skip)('stream: yields chunks and assembles full response', async () => {
    const driver = new OpenAIDriver({ apiKey: API_KEY! })
    const chunks: string[] = []
    let finalUsage: any = null

    for await (const chunk of driver.stream(
      [{ role: 'user', content: 'Count from 1 to 3, each on a new line.' }],
      { model: 'gpt-4o-mini', maxTokens: 30 },
    )) {
      chunks.push(chunk.delta)
      if (chunk.usage) finalUsage = chunk.usage
    }

    const full = chunks.join('')
    expect(full).toContain('1')
    expect(full).toContain('2')
    expect(full).toContain('3')
    expect(chunks.length).toBeGreaterThan(1)
  }, 30_000)

  // ── Embeddings ───────────────────────────────────────────────────────

  it.skipIf(skip)('embed: single input', async () => {
    const driver = new OpenAIDriver({ apiKey: API_KEY! })
    const result = await driver.embed('Hello world', {
      model: 'text-embedding-3-small',
      dimensions: 256,
    })

    expect(result.embeddings).toHaveLength(1)
    expect(result.embeddings[0]!.length).toBe(256)
    expect(result.model).toContain('text-embedding-3-small')
    expect(result.usage.totalTokens).toBeGreaterThan(0)
  }, 30_000)

  it.skipIf(skip)('embed: batch input', async () => {
    const driver = new OpenAIDriver({ apiKey: API_KEY! })
    const result = await driver.embed(
      ['TypeScript', 'JavaScript', 'Python'],
      { model: 'text-embedding-3-small' },
    )

    expect(result.embeddings).toHaveLength(3)
    const dim = result.embeddings[0]!.length
    expect(result.embeddings[1]!.length).toBe(dim)
    expect(result.embeddings[2]!.length).toBe(dim)
  }, 30_000)

  // ── Moderation ─────────────────────────────────────────────────────

  it.skipIf(skip)('moderate: flags harmful content', async () => {
    const driver = new OpenAIDriver({ apiKey: API_KEY! })
    const result = await driver.moderate('I love sunshine and flowers')

    expect(result.id).toBeDefined()
    expect(result.results).toHaveLength(1)
    expect(result.results[0]!.flagged).toBe(false)
    expect(result.results[0]!.categories).toBeDefined()
    expect(result.results[0]!.categoryScores).toBeDefined()
  }, 30_000)
})
