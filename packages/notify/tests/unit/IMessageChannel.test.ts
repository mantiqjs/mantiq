import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { IMessageChannel } from '../../src/channels/IMessageChannel.ts'
import { createMockNotifiable, TestNotification, setupFetchMock } from '../helpers.ts'

describe('IMessageChannel', () => {
  let channel: IMessageChannel
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    channel = new IMessageChannel({
      serviceUrl: 'https://imessage.example.com/api',
      authToken: 'imsg-auth-token-123',
    })
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('sends to serviceUrl/messages', async () => {
    const { calls } = setupFetchMock()

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['imessage'], {
      imessage: { to: 'user-id-abc', text: 'Hello iMessage!' },
    })

    await channel.send(notifiable, notification)

    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toBe('https://imessage.example.com/api/messages')
    expect(calls[0]!.init.method).toBe('POST')
  })

  it('includes auth header', async () => {
    const { calls } = setupFetchMock()

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['imessage'], {
      imessage: { to: 'user-id-abc', text: 'Test' },
    })

    await channel.send(notifiable, notification)

    expect(calls[0]!.init.headers['Authorization']).toBe('Bearer imsg-auth-token-123')
    expect(calls[0]!.init.headers['Content-Type']).toBe('application/json')
  })

  it('sends correct body with to and text', async () => {
    const { calls } = setupFetchMock()

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['imessage'], {
      imessage: { to: 'user-id-abc', text: 'Order update' },
    })

    await channel.send(notifiable, notification)

    const sentBody = JSON.parse(calls[0]!.init.body)
    expect(sentBody.to).toBe('user-id-abc')
    expect(sentBody.text).toBe('Order update')
  })

  it('includes interactiveData when provided', async () => {
    const { calls } = setupFetchMock()

    const interactiveData = {
      type: 'listPicker',
      items: [{ title: 'Option A' }, { title: 'Option B' }],
    }

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['imessage'], {
      imessage: { to: 'user-id-abc', text: 'Choose an option', interactiveData },
    })

    await channel.send(notifiable, notification)

    const sentBody = JSON.parse(calls[0]!.init.body)
    expect(sentBody.interactiveData).toEqual(interactiveData)
  })

  it('routes recipient from notifiable when not in payload', async () => {
    const { calls } = setupFetchMock()

    const notifiable = createMockNotifiable({ routes: { imessage: 'user-from-route' } })
    const notification = new TestNotification(['imessage'], {
      imessage: { text: 'Via route' },
    })

    await channel.send(notifiable, notification)

    const sentBody = JSON.parse(calls[0]!.init.body)
    expect(sentBody.to).toBe('user-from-route')
  })

  it('throws when no recipient available', async () => {
    setupFetchMock()

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['imessage'], {
      imessage: { text: 'No recipient' },
    })

    await expect(channel.send(notifiable, notification)).rejects.toThrow(/No iMessage recipient/)
  })

  it('throws on non-2xx response', async () => {
    setupFetchMock({ status: 403, body: 'Forbidden' })

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['imessage'], {
      imessage: { to: 'user-id-abc', text: 'Hello' },
    })

    await expect(channel.send(notifiable, notification)).rejects.toThrow(/iMessage API error \(403\)/)
  })

  it('skips when no payload', async () => {
    const { calls } = setupFetchMock()

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['imessage'], {})

    await channel.send(notifiable, notification)

    expect(calls).toHaveLength(0)
  })

  it('does not include interactiveData when not provided', async () => {
    const { calls } = setupFetchMock()

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['imessage'], {
      imessage: { to: 'user-id-abc', text: 'Plain message' },
    })

    await channel.send(notifiable, notification)

    const sentBody = JSON.parse(calls[0]!.init.body)
    expect(sentBody).not.toHaveProperty('interactiveData')
  })
})
