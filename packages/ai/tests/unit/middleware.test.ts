import { describe, it, expect } from 'bun:test'
import { CostTrackingMiddleware } from '../../src/middleware/CostTrackingMiddleware.ts'
import { ContentModerationMiddleware } from '../../src/middleware/ContentModerationMiddleware.ts'
import { PIIRedactionMiddleware } from '../../src/middleware/PIIRedactionMiddleware.ts'
import type { AIRequest } from '../../src/middleware/AIMiddleware.ts'
import type { ChatResponse } from '../../src/contracts/ChatMessage.ts'

const makeRequest = (content: string): AIRequest => ({
  messages: [{ role: 'user', content }],
  options: { model: 'gpt-4o' },
  provider: 'openai',
  metadata: {},
})

const makeResponse = (overrides: Partial<ChatResponse> = {}): ChatResponse => ({
  id: 'test',
  content: 'response',
  role: 'assistant',
  model: 'gpt-4o',
  toolCalls: [],
  usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
  finishReason: 'stop',
  raw: null,
  ...overrides,
})

describe('CostTrackingMiddleware', () => {
  it('estimates cost using built-in pricing', async () => {
    let tracked: { cost: number; model: string } | null = null

    const middleware = new CostTrackingMiddleware({
      onCost: (data) => { tracked = data },
    })

    await middleware.handle(makeRequest('Hi'), async () => makeResponse())

    expect(tracked).not.toBeNull()
    expect(tracked!.model).toBe('gpt-4o')
    expect(tracked!.cost).toBeGreaterThan(0)
  })

  it('uses custom pricing', async () => {
    let cost = 0

    const middleware = new CostTrackingMiddleware({
      pricing: { 'gpt-4o': { promptPer1k: 0.01, completionPer1k: 0.02 } },
      onCost: (data) => { cost = data.cost },
    })

    await middleware.handle(makeRequest('Hi'), async () =>
      makeResponse({ usage: { promptTokens: 1000, completionTokens: 1000, totalTokens: 2000 } })
    )

    expect(cost).toBeCloseTo(0.03) // 0.01 + 0.02
  })

  it('returns 0 for unknown model', () => {
    const middleware = new CostTrackingMiddleware({ pricing: {} })
    const cost = middleware.estimateCost('unknown-model', { promptTokens: 100, completionTokens: 50, totalTokens: 150 })
    expect(cost).toBe(0)
  })
})

describe('ContentModerationMiddleware', () => {
  it('passes clean content through', async () => {
    const middleware = new ContentModerationMiddleware({
      blockedPatterns: [/badword/i],
    })

    const response = await middleware.handle(makeRequest('Hello world'), async () => makeResponse())
    expect(response.content).toBe('response')
  })

  it('blocks content matching pattern', async () => {
    const middleware = new ContentModerationMiddleware({
      blockedPatterns: [/badword/i],
      action: 'block',
    })

    await expect(
      middleware.handle(makeRequest('This contains badword here'), async () => makeResponse())
    ).rejects.toThrow('Content moderation')
  })

  it('warns instead of blocking', async () => {
    const warnings: string[] = []
    const middleware = new ContentModerationMiddleware({
      blockedPatterns: [/badword/i],
      action: 'warn',
      onFlagged: (reason) => warnings.push(reason),
    })

    const response = await middleware.handle(makeRequest('badword'), async () => makeResponse())
    expect(response.content).toBe('response')
    expect(warnings).toHaveLength(1)
  })

  it('blocks content exceeding max length', async () => {
    const middleware = new ContentModerationMiddleware({
      maxLength: 10,
      action: 'block',
    })

    await expect(
      middleware.handle(makeRequest('This message is way too long'), async () => makeResponse())
    ).rejects.toThrow('maximum length')
  })

  it('ignores non-user messages', async () => {
    const middleware = new ContentModerationMiddleware({
      blockedPatterns: [/badword/i],
      action: 'block',
    })

    const request: AIRequest = {
      messages: [
        { role: 'system', content: 'System with badword' },
        { role: 'user', content: 'Clean message' },
      ],
      options: {},
      provider: 'openai',
      metadata: {},
    }

    const response = await middleware.handle(request, async () => makeResponse())
    expect(response.content).toBe('response')
  })
})

describe('PIIRedactionMiddleware', () => {
  it('redacts email addresses', async () => {
    const middleware = new PIIRedactionMiddleware({ types: ['email'] })
    let redacted = ''

    await middleware.handle(makeRequest('Contact john@example.com please'), async (req) => {
      redacted = req.messages[0]!.content as string
      return makeResponse()
    })

    expect(redacted).not.toContain('john@example.com')
    expect(redacted).toContain('[REDACTED]')
  })

  it('redacts phone numbers', async () => {
    const middleware = new PIIRedactionMiddleware({ types: ['phone'] })
    let redacted = ''

    await middleware.handle(makeRequest('Call me at (555) 123-4567'), async (req) => {
      redacted = req.messages[0]!.content as string
      return makeResponse()
    })

    expect(redacted).not.toContain('555')
    expect(redacted).toContain('[REDACTED]')
  })

  it('redacts SSNs', async () => {
    const middleware = new PIIRedactionMiddleware({ types: ['ssn'] })
    let redacted = ''

    await middleware.handle(makeRequest('SSN is 123-45-6789'), async (req) => {
      redacted = req.messages[0]!.content as string
      return makeResponse()
    })

    expect(redacted).not.toContain('123-45-6789')
  })

  it('redacts credit card numbers', async () => {
    const middleware = new PIIRedactionMiddleware({ types: ['creditCard'] })
    let redacted = ''

    await middleware.handle(makeRequest('Card: 4111-1111-1111-1111'), async (req) => {
      redacted = req.messages[0]!.content as string
      return makeResponse()
    })

    expect(redacted).not.toContain('4111')
  })

  it('uses custom replacement string', async () => {
    const middleware = new PIIRedactionMiddleware({ types: ['email'], replacement: '***' })
    let redacted = ''

    await middleware.handle(makeRequest('Email: test@example.com'), async (req) => {
      redacted = req.messages[0]!.content as string
      return makeResponse()
    })

    expect(redacted).toContain('***')
  })

  it('supports custom patterns', async () => {
    const middleware = new PIIRedactionMiddleware({
      types: [],
      customPatterns: [{ name: 'apikey', pattern: /sk-[a-zA-Z0-9]{32,}/g }],
    })
    let redacted = ''

    await middleware.handle(makeRequest('Key: sk-abcdefghijklmnopqrstuvwxyz123456'), async (req) => {
      redacted = req.messages[0]!.content as string
      return makeResponse()
    })

    expect(redacted).not.toContain('sk-abc')
    expect(redacted).toContain('[REDACTED]')
  })

  it('only redacts user messages', async () => {
    const middleware = new PIIRedactionMiddleware({ types: ['email'] })
    let systemMsg = ''

    const request: AIRequest = {
      messages: [
        { role: 'system', content: 'System has admin@internal.com' },
        { role: 'user', content: 'User has user@public.com' },
      ],
      options: {},
      provider: 'openai',
      metadata: {},
    }

    await middleware.handle(request, async (req) => {
      systemMsg = req.messages[0]!.content as string
      return makeResponse()
    })

    // System messages should NOT be redacted
    expect(systemMsg).toContain('admin@internal.com')
  })

  it('redact helper works standalone', () => {
    const middleware = new PIIRedactionMiddleware({ types: ['email', 'phone'] })
    const result = middleware.redact('Email john@test.com or call 555-123-4567')
    expect(result).not.toContain('john@test.com')
    expect(result).not.toContain('555-123-4567')
  })
})
