import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test'
import { AnthropicDriver } from '../../src/drivers/AnthropicDriver.ts'

describe('AnthropicDriver', () => {
  const originalFetch = globalThis.fetch
  let lastRequest: { url: string; body: any; headers: Record<string, string> } | null = null

  function mockFetch(responseBody: any, status = 200) {
    globalThis.fetch = mock(async (_url: any, init: any) => {
      lastRequest = {
        url: String(_url),
        body: init?.body ? JSON.parse(init.body) : null,
        headers: init?.headers ?? {},
      }
      return new Response(JSON.stringify(responseBody), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as any
  }

  beforeEach(() => { lastRequest = null })
  afterEach(() => { globalThis.fetch = originalFetch })

  it('separates system messages from user messages', async () => {
    mockFetch({
      id: 'msg-123',
      content: [{ type: 'text', text: 'Hello!' }],
      model: 'claude-sonnet-4-20250514',
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 5 },
    })

    const driver = new AnthropicDriver({ apiKey: 'test-key' })
    await driver.chat([
      { role: 'system', content: 'You are helpful' },
      { role: 'user', content: 'Hi' },
    ])

    expect(lastRequest!.body.system).toBe('You are helpful')
    expect(lastRequest!.body.messages).toEqual([{ role: 'user', content: 'Hi' }])
  })

  it('sends correct headers', async () => {
    mockFetch({
      id: 'msg-123',
      content: [{ type: 'text', text: '' }],
      model: 'claude-sonnet-4-20250514',
      stop_reason: 'end_turn',
      usage: { input_tokens: 0, output_tokens: 0 },
    })

    const driver = new AnthropicDriver({ apiKey: 'sk-test' })
    await driver.chat([{ role: 'user', content: 'Hi' }])

    expect(lastRequest!.headers['x-api-key']).toBe('sk-test')
    expect(lastRequest!.headers['anthropic-version']).toBe('2023-06-01')
    expect(lastRequest!.headers['Content-Type']).toBe('application/json')
  })

  it('parses text and tool_use content blocks', async () => {
    mockFetch({
      id: 'msg-456',
      content: [
        { type: 'text', text: 'Let me check the weather.' },
        { type: 'tool_use', id: 'tool_1', name: 'get_weather', input: { city: 'London' } },
      ],
      model: 'claude-sonnet-4-20250514',
      stop_reason: 'tool_use',
      usage: { input_tokens: 20, output_tokens: 30 },
    })

    const driver = new AnthropicDriver({ apiKey: 'k' })
    const response = await driver.chat([{ role: 'user', content: 'Weather?' }])

    expect(response.content).toBe('Let me check the weather.')
    expect(response.finishReason).toBe('tool_calls')
    expect(response.toolCalls).toHaveLength(1)
    expect(response.toolCalls[0]!.function.name).toBe('get_weather')
    expect(JSON.parse(response.toolCalls[0]!.function.arguments)).toEqual({ city: 'London' })
    expect(response.usage.promptTokens).toBe(20)
    expect(response.usage.completionTokens).toBe(30)
  })

  it('maps tools to Anthropic format', async () => {
    mockFetch({
      id: 'x',
      content: [{ type: 'text', text: '' }],
      model: 'claude-sonnet-4-20250514',
      stop_reason: 'end_turn',
      usage: { input_tokens: 0, output_tokens: 0 },
    })

    const driver = new AnthropicDriver({ apiKey: 'k' })
    await driver.chat(
      [{ role: 'user', content: 'Hi' }],
      {
        tools: [{
          type: 'function',
          function: { name: 'search', description: 'Search DB', parameters: { type: 'object' } },
        }],
      },
    )

    expect(lastRequest!.body.tools[0].name).toBe('search')
    expect(lastRequest!.body.tools[0].description).toBe('Search DB')
    expect(lastRequest!.body.tools[0].input_schema).toEqual({ type: 'object' })
  })

  it('maps tool results to tool_result content blocks', async () => {
    mockFetch({
      id: 'x',
      content: [{ type: 'text', text: 'The weather is sunny.' }],
      model: 'claude-sonnet-4-20250514',
      stop_reason: 'end_turn',
      usage: { input_tokens: 0, output_tokens: 0 },
    })

    const driver = new AnthropicDriver({ apiKey: 'k' })
    await driver.chat([
      { role: 'user', content: 'Weather?' },
      { role: 'assistant', content: 'Checking...', toolCalls: [{ id: 'call_1', type: 'function', function: { name: 'weather', arguments: '{}' } }] },
      { role: 'tool', content: '{"temp": 20}', toolCallId: 'call_1' },
    ])

    const toolMsg = lastRequest!.body.messages[2]
    expect(toolMsg.role).toBe('user')
    expect(toolMsg.content[0].type).toBe('tool_result')
    expect(toolMsg.content[0].tool_use_id).toBe('call_1')
  })

  it('throws for unsupported methods', async () => {
    const driver = new AnthropicDriver({ apiKey: 'k' })
    await expect(driver.embed('test')).rejects.toThrow('not support')
    await expect(driver.generateImage('test')).rejects.toThrow('not support')
    await expect(driver.speak('test')).rejects.toThrow('not support')
    await expect(driver.transcribe('test')).rejects.toThrow('not support')
    await expect(driver.moderate('test')).rejects.toThrow('not support')
  })
})
