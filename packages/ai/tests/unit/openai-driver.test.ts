import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test'
import { OpenAIDriver } from '../../src/drivers/OpenAIDriver.ts'

describe('OpenAIDriver', () => {
  const originalFetch = globalThis.fetch
  let lastRequest: { url: string; body: any; headers: Record<string, string> } | null = null

  function mockFetch(responseBody: any, status = 200) {
    globalThis.fetch = mock(async (url: any, init: any) => {
      lastRequest = {
        url: String(url),
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

  describe('chat', () => {
    it('sends correct request to /chat/completions', async () => {
      mockFetch({
        id: 'chatcmpl-123',
        model: 'gpt-4o',
        choices: [{
          message: { role: 'assistant', content: 'Hello!' },
          finish_reason: 'stop',
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      })

      const driver = new OpenAIDriver({ apiKey: 'test-key' })
      const response = await driver.chat(
        [{ role: 'user', content: 'Hi' }],
        { model: 'gpt-4o', temperature: 0.5 },
      )

      expect(lastRequest!.url).toBe('https://api.openai.com/v1/chat/completions')
      expect(lastRequest!.body.model).toBe('gpt-4o')
      expect(lastRequest!.body.temperature).toBe(0.5)
      expect(lastRequest!.body.messages).toEqual([{ role: 'user', content: 'Hi' }])
      expect(lastRequest!.headers['Authorization']).toBe('Bearer test-key')

      expect(response.content).toBe('Hello!')
      expect(response.model).toBe('gpt-4o')
      expect(response.usage.totalTokens).toBe(15)
      expect(response.finishReason).toBe('stop')
    })

    it('maps multimodal content parts', async () => {
      mockFetch({
        id: 'chatcmpl-456',
        model: 'gpt-4o',
        choices: [{ message: { role: 'assistant', content: 'I see a cat' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 50, completion_tokens: 10, total_tokens: 60 },
      })

      const driver = new OpenAIDriver({ apiKey: 'test-key' })
      await driver.chat([{
        role: 'user',
        content: [
          { type: 'text', text: 'What is this?' },
          { type: 'image_url', imageUrl: 'https://example.com/cat.jpg' },
        ],
      }])

      const msg = lastRequest!.body.messages[0]
      expect(msg.content).toHaveLength(2)
      expect(msg.content[0].type).toBe('text')
      expect(msg.content[1].type).toBe('image_url')
      expect(msg.content[1].image_url.url).toBe('https://example.com/cat.jpg')
    })

    it('maps image_base64 to data URI', async () => {
      mockFetch({
        id: 'x', model: 'gpt-4o',
        choices: [{ message: { role: 'assistant', content: '' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      })

      const driver = new OpenAIDriver({ apiKey: 'k' })
      await driver.chat([{
        role: 'user',
        content: [{ type: 'image_base64', imageBase64: 'abc123', mimeType: 'image/png' }],
      }])

      const part = lastRequest!.body.messages[0].content[0]
      expect(part.image_url.url).toBe('data:image/png;base64,abc123')
    })

    it('includes tools when provided', async () => {
      mockFetch({
        id: 'x', model: 'gpt-4o',
        choices: [{
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: 'call_1',
              type: 'function',
              function: { name: 'get_weather', arguments: '{"city":"London"}' },
            }],
          },
          finish_reason: 'tool_calls',
        }],
        usage: { prompt_tokens: 20, completion_tokens: 15, total_tokens: 35 },
      })

      const driver = new OpenAIDriver({ apiKey: 'k' })
      const response = await driver.chat(
        [{ role: 'user', content: 'Weather?' }],
        {
          tools: [{
            type: 'function',
            function: { name: 'get_weather', description: 'Get weather', parameters: { type: 'object' } },
          }],
        },
      )

      expect(lastRequest!.body.tools).toHaveLength(1)
      expect(response.finishReason).toBe('tool_calls')
      expect(response.toolCalls).toHaveLength(1)
      expect(response.toolCalls[0]!.function.name).toBe('get_weather')
    })

    it('maps json responseFormat', async () => {
      mockFetch({
        id: 'x', model: 'gpt-4o',
        choices: [{ message: { role: 'assistant', content: '{}' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      })

      const driver = new OpenAIDriver({ apiKey: 'k' })
      await driver.chat([{ role: 'user', content: 'JSON' }], { responseFormat: 'json' })

      expect(lastRequest!.body.response_format).toEqual({ type: 'json_object' })
    })

    it('uses custom baseUrl', async () => {
      mockFetch({
        id: 'x', model: 'custom',
        choices: [{ message: { role: 'assistant', content: '' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      })

      const driver = new OpenAIDriver({ apiKey: 'k', baseUrl: 'https://custom.api.com/v1' })
      await driver.chat([{ role: 'user', content: 'Hi' }])

      expect(lastRequest!.url).toBe('https://custom.api.com/v1/chat/completions')
    })

    it('includes organization header when set', async () => {
      mockFetch({
        id: 'x', model: 'gpt-4o',
        choices: [{ message: { role: 'assistant', content: '' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      })

      const driver = new OpenAIDriver({ apiKey: 'k', organization: 'org-123' })
      await driver.chat([{ role: 'user', content: 'Hi' }])

      expect(lastRequest!.headers['OpenAI-Organization']).toBe('org-123')
    })

    it('throws AIError on non-ok response', async () => {
      mockFetch({ error: { message: 'Invalid API key' } }, 401)

      const driver = new OpenAIDriver({ apiKey: 'bad-key' })
      await expect(driver.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow('OpenAI API error: 401')
    })
  })

  describe('stream', () => {
    function mockStreamFetch(lines: string[]) {
      globalThis.fetch = mock(async (url: any, init: any) => {
        lastRequest = {
          url: String(url),
          body: init?.body ? JSON.parse(init.body) : null,
          headers: init?.headers ?? {},
        }

        const encoder = new TextEncoder()
        return new Response(
          new ReadableStream({
            start(controller) {
              for (const line of lines) {
                controller.enqueue(encoder.encode(line))
              }
              controller.close()
            },
          }),
          {
            headers: { 'Content-Type': 'text/event-stream' },
          },
        )
      }) as any
    }

    it('skips malformed SSE chunks and continues yielding later chunks', async () => {
      mockStreamFetch([
        `data: ${JSON.stringify({
          id: 'chatcmpl-123',
          choices: [{ delta: { content: 'hel' }, finish_reason: null }],
        })}\n`,
        'data: {not-json}\n',
        `data: ${JSON.stringify({
          id: 'chatcmpl-123',
          choices: [{ delta: { content: 'lo' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
        })}\n`,
        'data: [DONE]\n',
      ])

      const driver = new OpenAIDriver({ apiKey: 'k' })
      const chunks = []
      for await (const chunk of driver.stream([{ role: 'user', content: 'Hi' }], { model: 'gpt-4o' })) {
        chunks.push(chunk)
      }

      expect(lastRequest!.url).toBe('https://api.openai.com/v1/chat/completions')
      expect(lastRequest!.body.stream).toBe(true)
      expect(chunks.map((chunk) => chunk.delta)).toEqual(['hel', 'lo'])
      expect(chunks[1]!.usage).toEqual({
        promptTokens: 3,
        completionTokens: 2,
        totalTokens: 5,
      })
    })
  })

  describe('embed', () => {
    it('sends correct request to /embeddings', async () => {
      mockFetch({
        data: [
          { embedding: [0.1, 0.2, 0.3] },
          { embedding: [0.4, 0.5, 0.6] },
        ],
        model: 'text-embedding-3-small',
        usage: { total_tokens: 10 },
      })

      const driver = new OpenAIDriver({ apiKey: 'k' })
      const result = await driver.embed(['Hello', 'World'], { dimensions: 256 })

      expect(lastRequest!.url).toBe('https://api.openai.com/v1/embeddings')
      expect(lastRequest!.body.input).toEqual(['Hello', 'World'])
      expect(lastRequest!.body.dimensions).toBe(256)
      expect(result.embeddings).toEqual([[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]])
      expect(result.usage.totalTokens).toBe(10)
    })
  })

  describe('generateImage', () => {
    it('sends correct request to /images/generations', async () => {
      mockFetch({
        data: [{ url: 'https://example.com/image.png', revised_prompt: 'A beautiful sunset' }],
      })

      const driver = new OpenAIDriver({ apiKey: 'k' })
      const result = await driver.generateImage('sunset', { size: '1024x1024', quality: 'hd' })

      expect(lastRequest!.url).toBe('https://api.openai.com/v1/images/generations')
      expect(lastRequest!.body.prompt).toBe('sunset')
      expect(lastRequest!.body.size).toBe('1024x1024')
      expect(result.images[0]!.url).toBe('https://example.com/image.png')
      expect(result.images[0]!.revisedPrompt).toBe('A beautiful sunset')
    })
  })

  describe('moderate', () => {
    it('sends correct request to /moderations', async () => {
      mockFetch({
        id: 'mod-123',
        results: [{
          flagged: true,
          categories: { violence: true, harassment: false },
          category_scores: { violence: 0.95, harassment: 0.01 },
        }],
      })

      const driver = new OpenAIDriver({ apiKey: 'k' })
      const result = await driver.moderate('test content')

      expect(lastRequest!.url).toBe('https://api.openai.com/v1/moderations')
      expect(result.results[0]!.flagged).toBe(true)
      expect(result.results[0]!.categories['violence']).toBe(true)
      expect(result.results[0]!.categoryScores['violence']).toBe(0.95)
    })
  })
})
