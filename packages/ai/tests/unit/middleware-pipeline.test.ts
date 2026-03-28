import { describe, it, expect } from 'bun:test'
import { AIManager } from '../../src/AIManager.ts'
import { AIFake } from '../../src/testing/AIFake.ts'
import type { AIMiddleware, AIRequest, AINextFunction } from '../../src/middleware/AIMiddleware.ts'
import type { ChatResponse } from '../../src/contracts/ChatMessage.ts'
import { PIIRedactionMiddleware } from '../../src/middleware/PIIRedactionMiddleware.ts'
import { CostTrackingMiddleware } from '../../src/middleware/CostTrackingMiddleware.ts'

const makeManager = (fake: AIFake): AIManager => {
  const manager = new AIManager({ default: 'test', providers: {} })
  manager.extend('test', () => fake)
  return manager
}

describe('AI middleware pipeline', () => {
  it('executes middleware in registration order', async () => {
    const order: string[] = []

    const middleware1: AIMiddleware = {
      async handle(request, next) {
        order.push('m1-before')
        const response = await next(request)
        order.push('m1-after')
        return response
      },
    }

    const middleware2: AIMiddleware = {
      async handle(request, next) {
        order.push('m2-before')
        const response = await next(request)
        order.push('m2-after')
        return response
      },
    }

    const fake = new AIFake()
    fake.respondWith({ content: 'ok' })
    const manager = makeManager(fake)
    manager.use(middleware1)
    manager.use(middleware2)

    await manager.chat('test-model').user('Hi').send()

    expect(order).toEqual(['m1-before', 'm2-before', 'm2-after', 'm1-after'])
  })

  it('middleware can modify the request before it reaches the driver', async () => {
    const prefixMiddleware: AIMiddleware = {
      async handle(request, next) {
        const modified: AIRequest = {
          ...request,
          messages: request.messages.map((msg) => {
            if (msg.role === 'user' && typeof msg.content === 'string') {
              return { ...msg, content: `[prefix] ${msg.content}` }
            }
            return msg
          }),
        }
        return next(modified)
      },
    }

    const fake = new AIFake()
    fake.respondWith({ content: 'response' })
    const manager = makeManager(fake)
    manager.use(prefixMiddleware)

    await manager.chat('test-model').user('Hello').send()

    const sent = fake.sent()
    expect(sent).toHaveLength(1)
    expect(sent[0]!.messages[0]!.content).toBe('[prefix] Hello')
  })

  it('the final driver receives the fully modified request', async () => {
    const uppercaseMiddleware: AIMiddleware = {
      async handle(request, next) {
        return next({
          ...request,
          messages: request.messages.map((msg) => {
            if (typeof msg.content === 'string') {
              return { ...msg, content: msg.content.toUpperCase() }
            }
            return msg
          }),
        })
      },
    }

    const appendMiddleware: AIMiddleware = {
      async handle(request, next) {
        return next({
          ...request,
          messages: request.messages.map((msg) => {
            if (typeof msg.content === 'string') {
              return { ...msg, content: `${msg.content}!!!` }
            }
            return msg
          }),
        })
      },
    }

    const fake = new AIFake()
    fake.respondWith({ content: 'done' })
    const manager = makeManager(fake)
    manager.use(uppercaseMiddleware)
    manager.use(appendMiddleware)

    await manager.chat('test-model').user('hello').send()

    const sent = fake.sent()
    expect(sent[0]!.messages[0]!.content).toBe('HELLO!!!')
  })

  it('skips pipeline when no middlewares are registered', async () => {
    const fake = new AIFake()
    fake.respondWith({ content: 'direct' })
    const manager = makeManager(fake)

    const response = await manager.chat('test-model').user('Hi').send()
    expect(response.content).toBe('direct')
    fake.assertSent(1)
  })

  it('use() is chainable', () => {
    const manager = new AIManager()
    const m1: AIMiddleware = { handle: async (req, next) => next(req) }
    const m2: AIMiddleware = { handle: async (req, next) => next(req) }

    const result = manager.use(m1).use(m2)
    expect(result).toBe(manager)
    expect(manager.getMiddlewares()).toHaveLength(2)
  })

  it('works with real PIIRedactionMiddleware', async () => {
    const fake = new AIFake()
    fake.respondWith({ content: 'ok' })
    const manager = makeManager(fake)
    manager.use(new PIIRedactionMiddleware({ types: ['email'] }))

    await manager.chat('test-model').user('Contact john@example.com').send()

    const sent = fake.sent()
    expect(sent[0]!.messages[0]!.content).not.toContain('john@example.com')
    expect(sent[0]!.messages[0]!.content).toContain('[REDACTED]')
  })

  it('works with real CostTrackingMiddleware', async () => {
    let trackedCost = -1

    const fake = new AIFake()
    fake.respondWith({
      content: 'ok',
      model: 'gpt-4o',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    })

    const manager = makeManager(fake)
    manager.use(new CostTrackingMiddleware({
      onCost: (data) => { trackedCost = data.cost },
    }))

    await manager.chat('gpt-4o').user('Hi').send()
    expect(trackedCost).toBeGreaterThan(0)
  })

  it('middleware can short-circuit the chain', async () => {
    const blockMiddleware: AIMiddleware = {
      async handle(_request, _next) {
        return {
          id: 'blocked',
          content: 'Request blocked',
          role: 'assistant' as const,
          model: 'none',
          toolCalls: [],
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          finishReason: 'stop' as const,
          raw: null,
        }
      },
    }

    const fake = new AIFake()
    fake.respondWith({ content: 'should not reach' })
    const manager = makeManager(fake)
    manager.use(blockMiddleware)

    const response = await manager.chat('test-model').user('Hi').send()
    expect(response.content).toBe('Request blocked')
    fake.assertNotSent()
  })
})
