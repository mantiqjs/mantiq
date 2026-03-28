import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { ResendTransport } from '../../../src/drivers/ResendTransport.ts'
import { Message } from '../../../src/Message.ts'
import { MailError } from '../../../src/errors/MailError.ts'

describe('ResendTransport', () => {
  const originalFetch = globalThis.fetch
  let capturedRequest: { url: string; init: RequestInit } | null
  let transport: ResendTransport

  beforeEach(() => {
    capturedRequest = null
    transport = new ResendTransport({ apiKey: 're_test_key_123' })
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  function mockFetchSuccess(responseBody: Record<string, any> = { id: 'msg_abc123' }) {
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

  test('sends to the correct Resend API endpoint', async () => {
    mockFetchSuccess()
    await transport.send(buildTestMessage())

    expect(capturedRequest!.url).toBe('https://api.resend.com/emails')
  })

  // ── Correct headers ─────────────────────────────────────────────────────────

  test('sends correct Authorization and Content-Type headers', async () => {
    mockFetchSuccess()
    await transport.send(buildTestMessage())

    const headers = capturedRequest!.init.headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer re_test_key_123')
    expect(headers['Content-Type']).toBe('application/json')
  })

  // ── Correct payload ─────────────────────────────────────────────────────────

  test('sends correct payload shape', async () => {
    mockFetchSuccess()
    await transport.send(buildTestMessage())

    const body = JSON.parse(capturedRequest!.init.body as string)
    expect(body.from).toBe('Sender <sender@example.com>')
    expect(body.to).toEqual(['recipient@example.com'])
    expect(body.subject).toBe('Test Email')
    expect(body.html).toBe('<p>Hello</p>')
    expect(body.text).toBe('Hello')
  })

  // ── Returns { id } on success ───────────────────────────────────────────────

  test('returns { id } from the API response', async () => {
    mockFetchSuccess({ id: 'msg_resend_xyz' })
    const result = await transport.send(buildTestMessage())

    expect(result).toEqual({ id: 'msg_resend_xyz' })
  })

  // ── Error: 401 bad API key ──────────────────────────────────────────────────

  test('throws MailError on 401 (bad API key)', async () => {
    mockFetchError(401, 'Unauthorized', '{"message":"Invalid API key"}')

    await expect(transport.send(buildTestMessage())).rejects.toThrow(MailError)
    try {
      await transport.send(buildTestMessage())
    } catch (err) {
      expect(err).toBeInstanceOf(MailError)
      expect((err as MailError).message).toContain('Resend API error')
      expect((err as MailError).message).toContain('401')
    }
  })

  // ── Error: 422 validation ──────────────────────────────────────────────────

  test('throws MailError on 422 (validation error)', async () => {
    mockFetchError(422, 'Unprocessable Entity', '{"message":"Missing required field: to"}')

    await expect(transport.send(buildTestMessage())).rejects.toThrow(MailError)
  })

  // ── Error: 429 rate limited ─────────────────────────────────────────────────

  test('throws MailError on 429 (rate limited)', async () => {
    mockFetchError(429, 'Too Many Requests', '{"message":"Rate limit exceeded"}')

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

  test('includes cc and bcc in the payload', async () => {
    mockFetchSuccess()
    const msg = buildTestMessage()
      .addCc({ address: 'cc@example.com', name: 'CC User' })
      .addBcc('bcc@example.com')

    await transport.send(msg)

    const body = JSON.parse(capturedRequest!.init.body as string)
    expect(body.cc).toEqual(['CC User <cc@example.com>'])
    expect(body.bcc).toEqual(['bcc@example.com'])
  })

  // ── Attachments ─────────────────────────────────────────────────────────────

  test('includes attachments as base64 in the payload', async () => {
    mockFetchSuccess()
    const msg = buildTestMessage()
      .addAttachment('readme.txt', 'Hello World', 'text/plain')

    await transport.send(msg)

    const body = JSON.parse(capturedRequest!.init.body as string)
    expect(body.attachments).toHaveLength(1)
    expect(body.attachments[0].filename).toBe('readme.txt')
    expect(body.attachments[0].content).toBe(Buffer.from('Hello World').toString('base64'))
    expect(body.attachments[0].type).toBe('text/plain')
  })

  // ── reply_to ────────────────────────────────────────────────────────────────

  test('includes reply_to in the payload', async () => {
    mockFetchSuccess()
    const msg = buildTestMessage()
      .addReplyTo('reply@example.com')

    await transport.send(msg)

    const body = JSON.parse(capturedRequest!.init.body as string)
    expect(body.reply_to).toEqual(['reply@example.com'])
  })

  // ── custom headers ──────────────────────────────────────────────────────────

  test('includes custom headers in the payload', async () => {
    mockFetchSuccess()
    const msg = buildTestMessage()
      .setHeader('X-Custom-Tag', 'campaign-1')

    await transport.send(msg)

    const body = JSON.parse(capturedRequest!.init.body as string)
    expect(body.headers).toEqual({ 'X-Custom-Tag': 'campaign-1' })
  })
})
