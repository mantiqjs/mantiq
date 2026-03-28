import { describe, test, expect } from 'bun:test'

describe('@mantiq/testing fake re-exports', () => {
  test('exports EventFake', async () => {
    const mod = await import('../../src/index.ts')
    expect(mod.EventFake).toBeDefined()
    expect(typeof mod.EventFake).toBe('function')
  })

  test('exports QueueFake', async () => {
    const mod = await import('../../src/index.ts')
    expect(mod.QueueFake).toBeDefined()
    expect(typeof mod.QueueFake).toBe('function')
  })

  test('exports MailFake', async () => {
    const mod = await import('../../src/index.ts')
    expect(mod.MailFake).toBeDefined()
    expect(typeof mod.MailFake).toBe('function')
  })

  test('exports NotificationFake', async () => {
    const mod = await import('../../src/index.ts')
    expect(mod.NotificationFake).toBeDefined()
    expect(typeof mod.NotificationFake).toBe('function')
  })

  test('exports HttpFake', async () => {
    const mod = await import('../../src/index.ts')
    expect(mod.HttpFake).toBeDefined()
    expect(typeof mod.HttpFake).toBe('function')
  })

  test('exports RealtimeFake', async () => {
    const mod = await import('../../src/index.ts')
    expect(mod.RealtimeFake).toBeDefined()
    expect(typeof mod.RealtimeFake).toBe('function')
  })

  test('all fakes are constructable', async () => {
    const { EventFake, QueueFake, MailFake, NotificationFake, HttpFake, RealtimeFake } =
      await import('../../src/index.ts')

    // EventFake.create() is a static factory
    expect(typeof EventFake.create).toBe('function')

    // Others are plain constructors
    expect(() => new QueueFake()).not.toThrow()
    expect(() => new MailFake()).not.toThrow()
    expect(() => new NotificationFake()).not.toThrow()
    expect(() => new HttpFake()).not.toThrow()
    expect(() => new RealtimeFake()).not.toThrow()
  })
})
