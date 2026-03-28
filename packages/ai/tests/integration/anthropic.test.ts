/**
 * Integration tests against the real Anthropic API.
 *
 * Requirements: ANTHROPIC_API_KEY environment variable set.
 * Uses claude-haiku-4-5-20251001 (cheapest model).
 * Estimated cost: ~$0.005 per full run.
 *
 * Skip: These tests are skipped automatically when ANTHROPIC_API_KEY is not set.
 */
import { describe, it, expect } from 'bun:test'
import { AnthropicDriver } from '../../src/drivers/AnthropicDriver.ts'

const API_KEY = process.env['ANTHROPIC_API_KEY']
const skip = !API_KEY
const MODEL = 'claude-haiku-4-5-20251001'

describe('Anthropic Integration', () => {
  it.skipIf(skip)('chat: basic completion', async () => {
    const driver = new AnthropicDriver({ apiKey: API_KEY! })
    const response = await driver.chat(
      [{ role: 'user', content: 'Respond with exactly: "test ok"' }],
      { model: MODEL, maxTokens: 20, temperature: 0 },
    )

    expect(response.content.toLowerCase()).toContain('test ok')
    expect(response.id).toMatch(/^msg_/)
    expect(response.usage.promptTokens).toBeGreaterThan(0)
    expect(response.usage.completionTokens).toBeGreaterThan(0)
    expect(response.finishReason).toBe('stop')
  }, 30_000)

  it.skipIf(skip)('chat: system prompt handled correctly', async () => {
    const driver = new AnthropicDriver({ apiKey: API_KEY! })
    const response = await driver.chat(
      [
        { role: 'system', content: 'You are a calculator. Only output the numeric result, nothing else.' },
        { role: 'user', content: '7 * 8' },
      ],
      { model: MODEL, maxTokens: 10, temperature: 0 },
    )

    expect(response.content).toContain('56')
  }, 30_000)

  it.skipIf(skip)('chat: tool calling', async () => {
    const driver = new AnthropicDriver({ apiKey: API_KEY! })
    const response = await driver.chat(
      [{ role: 'user', content: 'What is the weather in Paris?' }],
      {
        model: MODEL,
        maxTokens: 200,
        tools: [{
          type: 'function',
          function: {
            name: 'get_weather',
            description: 'Get current weather for a city',
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

  it.skipIf(skip)('stream: yields chunks', async () => {
    const driver = new AnthropicDriver({ apiKey: API_KEY! })
    const chunks: string[] = []

    for await (const chunk of driver.stream(
      [{ role: 'user', content: 'Say "hello world"' }],
      { model: MODEL, maxTokens: 20 },
    )) {
      chunks.push(chunk.delta)
    }

    const full = chunks.join('')
    expect(full.toLowerCase()).toContain('hello')
    expect(chunks.length).toBeGreaterThan(1)
  }, 30_000)
})
