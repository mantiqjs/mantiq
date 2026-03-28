import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { PostmarkTransport } from '../../../src/drivers/PostmarkTransport.ts'
import { Message } from '../../../src/Message.ts'
import { MailError } from '../../../src/errors/MailError.ts'

describe('PostmarkTransport', () => {
  const originalFetch = globalThis.fetch
  let capturedRequest: { url: string; init: RequestInit } | null
  let transport: PostmarkTransport

  beforeEach(() => {
    capturedRequest = null
    transport = new PostmarkTransport({ serverToken: 'pm-server-token-xyz' })
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  function mockFetchSuccess(responseBody: Record<string, any> = { MessageID: 'pm-msg-123', ErrorCode: 0, Message: 'OK' }) {
    globalThis.fetch = async (input: any, init?: any) => {
      capturedRequest = { url: typeof input === 'string' ? input : input.toString(), init: init ?? {} }
      return new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
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

  test('sends to the correct Postmark API endpoint', async () => {
    mockFetchSuccess()
    await transport.send(buildTestMessage())

    expect(capturedRequest!.url).toBe('https://api.postmarkapp.com/email')
  })

  // ── Correct headers ─────────────────────────────────────────────────────────

  test('sends correct X-Postmark-Server-Token, Content-Type, and Accept headers', async () => {
    mockFetchSuccess()
    await transport.send(buildTestMessage())

    const headers = capturedRequest!.init.headers as Record<string, string>
    expect(headers['X-Postmark-Server-Token']).toBe('pm-server-token-xyz')
    expect(headers['Content-Type']).toBe('application/json')
    expect(headers['Accept']).toBe('application/json')
  })

  // ── Correct payload ─────────────────────────────────────────────────────────

  test('sends correct payload shape with PascalCase keys', async () => {
    mockFetchSuccess()
    await transport.send(buildTestMessage())

    const body = JSON.parse(capturedRequest!.init.body as string)
    expect(body.From).toBe('Sender <sender@example.com>')
    expect(body.To).toBe('recipient@example.com')
    expect(body.Subject).toBe('Test Email')
    expect(body.HtmlBody).toBe('<p>Hello</p>')
    expect(body.TextBody).toBe('Hello')
  })

  // ── Returns { id } on success ───────────────────────────────────────────────

  test('returns { id } from MessageID in response', async () => {
    mockFetchSuccess({ MessageID: 'pm-unique-id-abc', ErrorCode: 0, Message: 'OK' })
    const result = await transport.send(buildTestMessage())

    expect(result).toEqual({ id: 'pm-unique-id-abc' })
  })

  // ── Error: Postmark ErrorCode != 0 ─────────────────────────────────────────

  test('throws MailError when ErrorCode is non-zero in a 200 response', async () => {
    mockFetchSuccess({ MessageID: '', ErrorCode: 300, Message: 'Invalid email request' })

    try {
      await transport.send(buildTestMessage())
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(MailError)
      expect((err as MailError).message).toContain('Postmark error')
      expect((err as MailError).message).toContain('Invalid email request')
    }
  })

  // ── Error: 401 bad API key ──────────────────────────────────────────────────

  test('throws MailError on 401 (bad server token)', async () => {
    mockFetchError(401, 'Unauthorized', '{"ErrorCode":10,"Message":"Bad or missing Server API token."}')

    try {
      await transport.send(buildTestMessage())
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(MailError)
      expect((err as MailError).message).toContain('Postmark API error')
      expect((err as MailError).message).toContain('401')
    }
  })

  // ── Error: 422 validation ──────────────────────────────────────────────────

  test('throws MailError on 422 (validation error)', async () => {
    mockFetchError(422, 'Unprocessable Entity', '{"ErrorCode":300,"Message":"Invalid \'To\' address."}')

    await expect(transport.send(buildTestMessage())).rejects.toThrow(MailError)
  })

  // ── Error: 429 rate limited ─────────────────────────────────────────────────

  test('throws MailError on 429 (rate limited)', async () => {
    mockFetchError(429, 'Too Many Requests', '{"ErrorCode":429,"Message":"Rate limit exceeded"}')

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

  test('includes Cc and Bcc in the payload', async () => {
    mockFetchSuccess()
    const msg = buildTestMessage()
      .addCc({ address: 'cc@example.com', name: 'CC User' })
      .addBcc('bcc@example.com')

    await transport.send(msg)

    const body = JSON.parse(capturedRequest!.init.body as string)
    expect(body.Cc).toBe('CC User <cc@example.com>')
    expect(body.Bcc).toBe('bcc@example.com')
  })

  // ── Attachments ─────────────────────────────────────────────────────────────

  test('includes Attachments as base64 with PascalCase keys', async () => {
    mockFetchSuccess()
    const msg = buildTestMessage()
      .addAttachment('invoice.pdf', 'PDF bytes', 'application/pdf')

    await transport.send(msg)

    const body = JSON.parse(capturedRequest!.init.body as string)
    expect(body.Attachments).toHaveLength(1)
    expect(body.Attachments[0].Name).toBe('invoice.pdf')
    expect(body.Attachments[0].Content).toBe(Buffer.from('PDF bytes').toString('base64'))
    expect(body.Attachments[0].ContentType).toBe('application/pdf')
  })

  // ── ReplyTo ─────────────────────────────────────────────────────────────────

  test('includes ReplyTo in the payload', async () => {
    mockFetchSuccess()
    const msg = buildTestMessage()
      .addReplyTo('reply@example.com')

    await transport.send(msg)

    const body = JSON.parse(capturedRequest!.init.body as string)
    expect(body.ReplyTo).toBe('reply@example.com')
  })

  // ── Custom headers ──────────────────────────────────────────────────────────

  test('includes custom Headers array in the payload', async () => {
    mockFetchSuccess()
    const msg = buildTestMessage()
      .setHeader('X-Campaign-Id', 'abc-123')

    await transport.send(msg)

    const body = JSON.parse(capturedRequest!.init.body as string)
    expect(body.Headers).toEqual([{ Name: 'X-Campaign-Id', Value: 'abc-123' }])
  })
})
