import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { TelegramChannel } from '../../src/channels/TelegramChannel.ts'
import { createMockNotifiable, TestNotification, setupFetchMock } from '../helpers.ts'

describe('TelegramChannel', () => {
  let channel: TelegramChannel
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    channel = new TelegramChannel({ botToken: 'bot123456:ABC-DEF' })
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('sends to correct Telegram API URL', async () => {
    const { calls } = setupFetchMock({ body: { ok: true, result: {} } })

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['telegram'], {
      telegram: { chatId: '12345', text: 'Hello Telegram!' },
    })

    await channel.send(notifiable, notification)

    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toBe('https://api.telegram.org/botbot123456:ABC-DEF/sendMessage')
    expect(calls[0]!.init.method).toBe('POST')
  })

  it('includes chat_id, text, and parse_mode in body', async () => {
    const { calls } = setupFetchMock({ body: { ok: true, result: {} } })

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['telegram'], {
      telegram: { chatId: '12345', text: '<b>Bold</b>', parseMode: 'HTML' },
    })

    await channel.send(notifiable, notification)

    const sentBody = JSON.parse(calls[0]!.init.body)
    expect(sentBody.chat_id).toBe('12345')
    expect(sentBody.text).toBe('<b>Bold</b>')
    expect(sentBody.parse_mode).toBe('HTML')
  })

  it('includes reply_markup when provided', async () => {
    const { calls } = setupFetchMock({ body: { ok: true, result: {} } })

    const replyMarkup = {
      inline_keyboard: [[{ text: 'Click me', callback_data: 'btn1' }]],
    }

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['telegram'], {
      telegram: { chatId: '12345', text: 'With button', replyMarkup },
    })

    await channel.send(notifiable, notification)

    const sentBody = JSON.parse(calls[0]!.init.body)
    expect(sentBody.reply_markup).toEqual(replyMarkup)
  })

  it('falls back to notifiable route for chatId', async () => {
    const { calls } = setupFetchMock({ body: { ok: true, result: {} } })

    const notifiable = createMockNotifiable({ routes: { telegram: '99999' } })
    const notification = new TestNotification(['telegram'], {
      telegram: { text: 'Hello!' },
    })

    await channel.send(notifiable, notification)

    const sentBody = JSON.parse(calls[0]!.init.body)
    expect(sentBody.chat_id).toBe('99999')
  })

  it('throws when no chatId is available', async () => {
    setupFetchMock({ body: { ok: true, result: {} } })

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['telegram'], {
      telegram: { text: 'Hello!' },
    })

    await expect(channel.send(notifiable, notification)).rejects.toThrow(/No Telegram chat ID/)
  })

  it('throws on non-2xx HTTP response', async () => {
    setupFetchMock({ status: 401, body: 'Unauthorized' })

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['telegram'], {
      telegram: { chatId: '12345', text: 'Hello!' },
    })

    await expect(channel.send(notifiable, notification)).rejects.toThrow(/Telegram API error \(401\)/)
  })

  it('throws on Telegram API error response (ok: false)', async () => {
    setupFetchMock({
      status: 200,
      body: { ok: false, error_code: 400, description: 'Bad Request: chat not found' },
    })

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['telegram'], {
      telegram: { chatId: '12345', text: 'Hello!' },
    })

    await expect(channel.send(notifiable, notification)).rejects.toThrow(/Bad Request: chat not found/)
  })

  it('skips when no payload', async () => {
    const { calls } = setupFetchMock({ body: { ok: true, result: {} } })

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['telegram'], {})

    await channel.send(notifiable, notification)

    expect(calls).toHaveLength(0)
  })

  it('does not include parse_mode when not specified', async () => {
    const { calls } = setupFetchMock({ body: { ok: true, result: {} } })

    const notifiable = createMockNotifiable()
    const notification = new TestNotification(['telegram'], {
      telegram: { chatId: '12345', text: 'Plain text' },
    })

    await channel.send(notifiable, notification)

    const sentBody = JSON.parse(calls[0]!.init.body)
    expect(sentBody).not.toHaveProperty('parse_mode')
  })
})
