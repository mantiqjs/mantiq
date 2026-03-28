import { describe, it, expect } from 'bun:test'
import { AIManager } from '../../src/AIManager.ts'
import { NullDriver } from '../../src/drivers/NullDriver.ts'
import { AIFake } from '../../src/testing/AIFake.ts'

describe('AIManager', () => {
  it('resolves default driver', () => {
    const manager = new AIManager({ default: 'null', providers: { null: { driver: 'null' } } })
    const driver = manager.driver()
    expect(driver).toBeInstanceOf(NullDriver)
  })

  it('caches drivers', () => {
    const manager = new AIManager({ default: 'null', providers: { null: { driver: 'null' } } })
    const d1 = manager.driver()
    const d2 = manager.driver()
    expect(d1).toBe(d2)
  })

  it('resolves named drivers', () => {
    const manager = new AIManager({
      default: 'null',
      providers: {
        null: { driver: 'null' },
        openai: { driver: 'openai', apiKey: 'test' },
      },
    })
    const openai = manager.driver('openai')
    const nullDriver = manager.driver('null')
    expect(openai).not.toBe(nullDriver)
  })

  it('throws for unconfigured provider', () => {
    const manager = new AIManager({ default: 'null', providers: { null: { driver: 'null' } } })
    expect(() => manager.driver('nonexistent')).toThrow('not configured')
  })

  it('throws for unsupported driver type', () => {
    const manager = new AIManager({
      default: 'custom',
      providers: { custom: { driver: 'postgres' as any } },
    })
    expect(() => manager.driver()).toThrow('Unsupported')
  })

  it('supports extend() for custom drivers', async () => {
    const fake = new AIFake()
    fake.respondWith({ content: 'Custom!' })

    const manager = new AIManager({ default: 'custom', providers: {} })
    manager.extend('custom', () => fake)

    const response = await manager.driver('custom').chat([{ role: 'user', content: 'Hi' }])
    expect(response.content).toBe('Custom!')
  })

  it('extend invalidates cached driver', async () => {
    const fake1 = new AIFake()
    fake1.respondWith({ content: 'v1' })
    const fake2 = new AIFake()
    fake2.respondWith({ content: 'v2' })

    const manager = new AIManager({ default: 'test', providers: {} })
    manager.extend('test', () => fake1)
    const r1 = await manager.driver('test').chat([{ role: 'user', content: 'Hi' }])
    expect(r1.content).toBe('v1')

    manager.extend('test', () => fake2)
    const r2 = await manager.driver('test').chat([{ role: 'user', content: 'Hi' }])
    expect(r2.content).toBe('v2')
  })

  it('chat() returns PendingChat', () => {
    const manager = new AIManager()
    const pending = manager.chat('gpt-4o')
    expect(pending).toBeDefined()
    expect(pending.constructor.name).toBe('PendingChat')
  })

  it('chat() uses defaultModel if no model specified', async () => {
    const fake = new AIFake()
    const manager = new AIManager({ default: 'test', providers: {}, defaultModel: 'gpt-4o-mini' })
    manager.extend('test', () => fake)

    await manager.chat().user('Hi').send()

    // The default model should be set on the pending chat
    fake.assertSent(1)
  })

  it('provider() is alias for driver()', () => {
    const manager = new AIManager()
    expect(manager.provider()).toBe(manager.driver())
  })

  it('getDefaultDriver returns config value', () => {
    const manager = new AIManager({ default: 'anthropic', providers: { anthropic: { driver: 'anthropic', apiKey: 'k' } } })
    expect(manager.getDefaultDriver()).toBe('anthropic')
  })

  it('getDefaultModel returns config value', () => {
    const manager = new AIManager({ default: 'null', providers: {}, defaultModel: 'gpt-4o' })
    expect(manager.getDefaultModel()).toBe('gpt-4o')
  })

  it('resolves all built-in driver types', () => {
    const configs: Record<string, any> = {
      openai: { driver: 'openai', apiKey: 'k' },
      anthropic: { driver: 'anthropic', apiKey: 'k' },
      gemini: { driver: 'gemini', apiKey: 'k' },
      ollama: { driver: 'ollama' },
      azure: { driver: 'azure-openai', apiKey: 'k', endpoint: 'https://x.openai.azure.com', deploymentId: 'd' },
      bedrock: { driver: 'bedrock', region: 'us-east-1' },
      null: { driver: 'null' },
    }

    const manager = new AIManager({ default: 'null', providers: configs })

    for (const name of Object.keys(configs)) {
      expect(() => manager.driver(name)).not.toThrow()
    }
  })
})
