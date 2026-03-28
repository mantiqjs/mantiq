import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { SendGridTransport } from '../../../src/drivers/SendGridTransport.ts'
import { Message } from '../../../src/Message.ts'
import { MailError } from '../../../src/errors/MailError.ts'

describe('SendGridTransport', () => {
  const originalFetch = globalThis.fetch
  let capturedRequest: { url: string; init: RequestInit } | null
  let transport: SendGridTransport

  beforeEach(() => {
    capturedRequest = null
    transport = new SendGridTransport({ apiKey: 'SG.test_key_abc' })
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  function mockFetchSuccess(messageId = 'sg-msg-id-456') {
    globalThis.fetch = async (input: any, init?: any) => {
      capturedRequest = { url: typeof input === 'string' ? input : input.toString(), init: init ?? {} }
      return new Response('', {
        status: 202,
        headers: { 'x-message-id': messageId },
      })
    }
  }

  function mockFetchError(status: number, statusText: string, body: string) {
    globalThis.fetch = async (input: any, init?: any) => {
      capturedRequest = { url: typeof input === 'string' ? input : input.toString(), init: init ?? {} }
      return new Response(body, { status, statusText })
    }
  }

  function buildTestMessage(): Message {
    return new Message()
      .setFrom({ address: 'sender@example.com', name: 'Sender' })
      .addTo('recipient@example.com')
      .setSubject('Test Email')
      .setHtml('<p>Hello</p>')
      .setText('Hello')
  }

  // ── Correct endpoint ────────────────────────────────────────────────────────

  test('sends to the correct SendGrid API endpoint', async () => {
    mockFetchSuccess()
    await transport.send(buildTestMessage())

    expect(capturedRequest!.url).toBe('https://api.sendgrid.com/v3/mail/send')
  })

  // ── Correct headers ─────────────────────────────────────────────────────────

  test('sends correct Authorization and Content-Type headers', async () => {
    mockFetchSuccess()
    await transport.send(buildTestMessage())

    const headers = capturedRequest!.init.headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer SG.test_key_abc')
    expect(headers['Content-Type']).toBe('application/json')
  })

  // ── Correct payload ─────────────────────────────────────────────────────────

  test('sends correct payload shape with personalizations', async () => {
    mockFetchSuccess()
    await transport.send(buildTestMessage())

    const body = JSON.parse(capturedRequest!.init.body as string)
    expect(body.personalizations).toHaveLength(1)
    expect(body.personalizations[0].to).toEqual([{ email: 'recipient@example.com' }])
    expect(body.from).toEqual({ email: 'sender@example.com', name: 'Sender' })
    expect(body.subject).toBe('Test Email')
    expect(body.content).toEqual([
      { type: 'text/plain', value: 'Hello' },
      { type: 'text/html', value: '<p>Hello</p>' },
    ])
  })

  // ── Returns { id } on success ───────────────────────────────────────────────

  test('returns { id } from x-message-id header', async () => {
    mockFetchSuccess('sg-unique-id')
    const result = await transport.send(buildTestMessage())

    expect(result).toEqual({ id: 'sg-unique-id' })
  })

  test('returns a generated UUID when x-message-id header is absent', async () => {
    globalThis.fetch = async (input: any, init?: any) => {
      capturedRequest = { url: typeof input === 'string' ? input : input.toString(), init: init ?? {} }
      return new Response('', { status: 202 })
    }

    const result = await transport.send(buildTestMessage())
    expect(typeof result.id).toBe('string')
    expect(result.id.length).toBeGreaterThan(0)
  })

  // ── Error: 401 bad API key ──────────────────────────────────────────────────

  test('throws MailError on 401 (bad API key)', async () => {
    mockFetchError(401, 'Unauthorized', '{"errors":[{"message":"The provided authorization grant is invalid"}]}')

    try {
      await transport.send(buildTestMessage())
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(MailError)
      expect((err as MailError).message).toContain('SendGrid API error')
      expect((err as MailError).message).toContain('401')
    }
  })

  // ── Error: 422 validation ──────────────────────────────────────────────────

  test('throws MailError on 422 (validation error)', async () => {
    mockFetchError(422, 'Unprocessable Entity', '{"errors":[{"message":"The to field is required"}]}')

    await expect(transport.send(buildTestMessage())).rejects.toThrow(MailError)
  })

  // ── Error: 429 rate limited ─────────────────────────────────────────────────

  test('throws MailError on 429 (rate limited)', async () => {
    mockFetchError(429, 'Too Many Requests', '{"errors":[{"message":"too many requests"}]}')

    try {
      await transport.send(buildTestMessage())
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(MailError)
      expect((err as MailError).message).toContain('429')
    }
  })

  // ── Error: network failure ──────────────────────────────────────────────────

  test('throws on network failure (fetch rejects)', async () => {
    globalThis.fetch = async () => {
      throw new TypeError('fetch failed')
    }

    await expect(transport.send(buildTestMessage())).rejects.toThrow()
  })

  // ── cc/bcc recipients ──────────────────────────────────────────────────────

  test('includes cc and bcc in personalizations', async () => {
    mockFetchSuccess()
    const msg = buildTestMessage()
      .addCc({ address: 'cc@example.com', name: 'CC User' })
      .addBcc('bcc@example.com')

    await transport.send(msg)

    const body = JSON.parse(capturedRequest!.init.body as string)
    expect(body.personalizations[0].cc).toEqual([{ email: 'cc@example.com', name: 'CC User' }])
    expect(body.personalizations[0].bcc).toEqual([{ email: 'bcc@example.com' }])
  })

  // ── Attachments ─────────────────────────────────────────────────────────────

  test('includes attachments as base64 in the payload', async () => {
    mockFetchSuccess()
    const msg = buildTestMessage()
      .addAttachment('report.pdf', 'PDF content', 'application/pdf')

    await transport.send(msg)

    const body = JSON.parse(capturedRequest!.init.body as string)
    expect(body.attachments).toHaveLength(1)
    expect(body.attachments[0].filename).toBe('report.pdf')
    expect(body.attachments[0].content).toBe(Buffer.from('PDF content').toString('base64'))
    expect(body.attachments[0].type).toBe('application/pdf')
    expect(body.attachments[0].disposition).toBe('attachment')
  })

  // ── reply_to ────────────────────────────────────────────────────────────────

  test('includes reply_to in the payload', async () => {
    mockFetchSuccess()
    const msg = buildTestMessage()
      .addReplyTo({ address: 'reply@example.com', name: 'Support' })

    await transport.send(msg)

    const body = JSON.parse(capturedRequest!.init.body as string)
    expect(body.reply_to).toEqual({ email: 'reply@example.com', name: 'Support' })
  })
})
