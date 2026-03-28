/**
 * Integration tests against the real Google Gemini API.
 *
 * Requirements: GEMINI_API_KEY environment variable set.
 * Uses gemini-2.0-flash (free tier: 15 RPM, 1M TPM).
 * Estimated cost: Free within limits.
 *
 * Skip: These tests are skipped automatically when GEMINI_API_KEY is not set.
 */
import { describe, it, expect } from 'bun:test'
import { GeminiDriver } from '../../src/drivers/GeminiDriver.ts'

const API_KEY = process.env['GEMINI_API_KEY']
const skip = !API_KEY
const MODEL = 'gemini-2.0-flash'

describe('Gemini Integration', () => {
  it.skipIf(skip)('chat: basic completion', async () => {
    const driver = new GeminiDriver({ apiKey: API_KEY! })
    const response = await driver.chat(
      [{ role: 'user', content: 'Respond with exactly: "test ok"' }],
      { model: MODEL, maxTokens: 20, temperature: 0 },
    )

    expect(response.content.toLowerCase()).toContain('test ok')
    expect(response.usage.totalTokens).toBeGreaterThan(0)
    expect(response.finishReason).toBe('stop')
  }, 30_000)

  it.skipIf(skip)('chat: system instruction', async () => {
    const driver = new GeminiDriver({ apiKey: API_KEY! })
    const response = await driver.chat(
      [
        { role: 'system', content: 'You are a calculator. Only output the numeric result.' },
        { role: 'user', content: '9 + 16' },
      ],
      { model: MODEL, maxTokens: 10, temperature: 0 },
    )

    expect(response.content).toContain('25')
  }, 30_000)

  it.skipIf(skip)('chat: JSON mode', async () => {
    const driver = new GeminiDriver({ apiKey: API_KEY! })
    const response = await driver.chat(
      [{ role: 'user', content: 'Return a JSON object with key "animal" and value "cat".' }],
      { model: MODEL, maxTokens: 50, temperature: 0, responseFormat: 'json' },
    )

    const parsed = JSON.parse(response.content)
    expect(parsed.animal).toBe('cat')
  }, 30_000)

  it.skipIf(skip)('chat: tool calling', async () => {
    const driver = new GeminiDriver({ apiKey: API_KEY! })
    const response = await driver.chat(
      [{ role: 'user', content: 'What is the weather in Berlin?' }],
      {
        model: MODEL,
        maxTokens: 200,
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
  }, 30_000)

  it.skipIf(skip)('embed: batch input', async () => {
    const driver = new GeminiDriver({ apiKey: API_KEY! })
    const result = await driver.embed(
      ['Hello world', 'Goodbye world'],
      { model: 'text-embedding-004' },
    )

    expect(result.embeddings).toHaveLength(2)
    expect(result.embeddings[0]!.length).toBeGreaterThan(0)
    expect(result.embeddings[0]!.length).toBe(result.embeddings[1]!.length)
  }, 30_000)

  it.skipIf(skip)('stream: yields chunks', async () => {
    const driver = new GeminiDriver({ apiKey: API_KEY! })
    const chunks: string[] = []

    for await (const chunk of driver.stream(
      [{ role: 'user', content: 'Count from 1 to 3.' }],
      { model: MODEL, maxTokens: 30 },
    )) {
      chunks.push(chunk.delta)
    }

    const full = chunks.join('')
    expect(full).toContain('1')
    expect(full.length).toBeGreaterThan(0)
  }, 30_000)
})
