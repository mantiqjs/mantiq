import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { SmsChannel } from '../../src/channels/SmsChannel.ts'
import { createMockNotifiable, TestNotification, setupFetchMock } from '../helpers.ts'

describe('SmsChannel', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('Twilio driver', () => {
    let channel: SmsChannel

    beforeEach(() => {
      channel = new SmsChannel({
        driver: 'twilio',
        twilio: { sid: 'AC123', token: 'auth-token-xyz', from: '+15551234567' },
      })
    })

    it('sends to correct Twilio URL', async () => {
      const { calls } = setupFetchMock()

      const notifiable = createMockNotifiable()
      const notification = new TestNotification(['sms'], {
        sms: { to: '+15559876543', body: 'Your code is 1234' },
      })

      await channel.send(notifiable, notification)

      expect(calls).toHaveLength(1)
      expect(calls[0]!.url).toBe('https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json')
      expect(calls[0]!.init.method).toBe('POST')
    })

    it('uses Basic auth with sid:token', async () => {
      const { calls } = setupFetchMock()

      const notifiable = createMockNotifiable()
      const notification = new TestNotification(['sms'], {
        sms: { to: '+15559876543', body: 'Test' },
      })

      await channel.send(notifiable, notification)

      const expectedCredentials = btoa('AC123:auth-token-xyz')
      expect(calls[0]!.init.headers['Authorization']).toBe(`Basic ${expectedCredentials}`)
    })

    it('sends form-encoded body with To, From, Body', async () => {
      const { calls } = setupFetchMock()

      const notifiable = createMockNotifiable()
      const notification = new TestNotification(['sms'], {
        sms: { to: '+15559876543', body: 'Your code is 1234' },
      })

      await channel.send(notifiable, notification)

      expect(calls[0]!.init.headers['Content-Type']).toBe('application/x-www-form-urlencoded')

      const body = calls[0]!.init.body as string
      const params = new URLSearchParams(body)
      expect(params.get('To')).toBe('+15559876543')
      expect(params.get('From')).toBe('+15551234567')
      expect(params.get('Body')).toBe('Your code is 1234')
    })

    it('routes phone from notifiable when not in payload', async () => {
      const { calls } = setupFetchMock()

      const notifiable = createMockNotifiable({ routes: { sms: '+15551111111' } })
      const notification = new TestNotification(['sms'], {
        sms: { body: 'Hello from notifiable route' },
      })

      await channel.send(notifiable, notification)

      const body = calls[0]!.init.body as string
      const params = new URLSearchParams(body)
      expect(params.get('To')).toBe('+15551111111')
    })

    it('throws when no recipient available', async () => {
      setupFetchMock()

      const notifiable = createMockNotifiable()
      const notification = new TestNotification(['sms'], {
        sms: { body: 'No recipient' },
      })

      await expect(channel.send(notifiable, notification)).rejects.toThrow(/No SMS recipient/)
    })

    it('throws when body is missing', async () => {
      setupFetchMock()

      const notifiable = createMockNotifiable()
      const notification = new TestNotification(['sms'], {
        sms: { to: '+15559876543' },
      })

      await expect(channel.send(notifiable, notification)).rejects.toThrow(/SMS body is required/)
    })

    it('throws on non-2xx response', async () => {
      setupFetchMock({ status: 400, body: 'Bad Request' })

      const notifiable = createMockNotifiable()
      const notification = new TestNotification(['sms'], {
        sms: { to: '+15559876543', body: 'Hello' },
      })

      await expect(channel.send(notifiable, notification)).rejects.toThrow(/Twilio API error \(400\)/)
    })
  })

  describe('Vonage driver', () => {
    let channel: SmsChannel

    beforeEach(() => {
      channel = new SmsChannel({
        driver: 'vonage',
        vonage: { apiKey: 'key123', apiSecret: 'secret456', from: 'Mantiq' },
      })
    })

    it('sends to correct Vonage URL', async () => {
      const { calls } = setupFetchMock({
        body: { messages: [{ status: '0' }] },
      })

      const notifiable = createMockNotifiable()
      const notification = new TestNotification(['sms'], {
        sms: { to: '+15559876543', body: 'Hello from Vonage' },
      })

      await channel.send(notifiable, notification)

      expect(calls).toHaveLength(1)
      expect(calls[0]!.url).toBe('https://rest.nexmo.com/sms/json')
      expect(calls[0]!.init.method).toBe('POST')
    })

    it('sends JSON body with api_key, api_secret, from, to, text', async () => {
      const { calls } = setupFetchMock({
        body: { messages: [{ status: '0' }] },
      })

      const notifiable = createMockNotifiable()
      const notification = new TestNotification(['sms'], {
        sms: { to: '+15559876543', body: 'Hello Vonage' },
      })

      await channel.send(notifiable, notification)

      expect(calls[0]!.init.headers['Content-Type']).toBe('application/json')

      const sentBody = JSON.parse(calls[0]!.init.body)
      expect(sentBody.api_key).toBe('key123')
      expect(sentBody.api_secret).toBe('secret456')
      expect(sentBody.from).toBe('Mantiq')
      expect(sentBody.to).toBe('+15559876543')
      expect(sentBody.text).toBe('Hello Vonage')
    })

    it('routes phone from notifiable', async () => {
      const { calls } = setupFetchMock({
        body: { messages: [{ status: '0' }] },
      })

      const notifiable = createMockNotifiable({ routes: { sms: '+15552222222' } })
      const notification = new TestNotification(['sms'], {
        sms: { body: 'Vonage from route' },
      })

      await channel.send(notifiable, notification)

      const sentBody = JSON.parse(calls[0]!.init.body)
      expect(sentBody.to).toBe('+15552222222')
    })

    it('throws on non-2xx HTTP response', async () => {
      setupFetchMock({ status: 500, body: 'Server Error' })

      const notifiable = createMockNotifiable()
      const notification = new TestNotification(['sms'], {
        sms: { to: '+15559876543', body: 'Hello' },
      })

      await expect(channel.send(notifiable, notification)).rejects.toThrow(/Vonage API error \(500\)/)
    })

    it('throws on Vonage delivery failure (status != 0)', async () => {
      setupFetchMock({
        body: { messages: [{ status: '4', 'error-text': 'Invalid credentials' }] },
      })

      const notifiable = createMockNotifiable()
      const notification = new TestNotification(['sms'], {
        sms: { to: '+15559876543', body: 'Hello' },
      })

      await expect(channel.send(notifiable, notification)).rejects.toThrow(/Invalid credentials/)
    })
  })

  describe('unsupported driver', () => {
    it('throws for unknown driver', async () => {
      const channel = new SmsChannel({
        driver: 'unknown' as any,
      })
      setupFetchMock()

      const notifiable = createMockNotifiable()
      const notification = new TestNotification(['sms'], {
        sms: { to: '+15559876543', body: 'Hello' },
      })

      await expect(channel.send(notifiable, notification)).rejects.toThrow(/Unsupported SMS driver/)
    })
  })

  describe('skip behavior', () => {
    it('skips when no payload', async () => {
      const channel = new SmsChannel({
        driver: 'twilio',
        twilio: { sid: 'AC123', token: 'tok', from: '+1' },
      })
      const { calls } = setupFetchMock()

      const notifiable = createMockNotifiable()
      const notification = new TestNotification(['sms'], {})

      await channel.send(notifiable, notification)

      expect(calls).toHaveLength(0)
    })
  })

  describe('missing driver config', () => {
    it('throws when twilio config is missing', async () => {
      const channel = new SmsChannel({ driver: 'twilio' })
      setupFetchMock()

      const notifiable = createMockNotifiable()
      const notification = new TestNotification(['sms'], {
        sms: { to: '+15559876543', body: 'Hello' },
      })

      await expect(channel.send(notifiable, notification)).rejects.toThrow(/Twilio configuration is missing/)
    })

    it('throws when vonage config is missing', async () => {
      const channel = new SmsChannel({ driver: 'vonage' })
      setupFetchMock()

      const notifiable = createMockNotifiable()
      const notification = new TestNotification(['sms'], {
        sms: { to: '+15559876543', body: 'Hello' },
      })

      await expect(channel.send(notifiable, notification)).rejects.toThrow(/Vonage configuration is missing/)
    })
  })
})
