import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { MailgunTransport } from '../../../src/drivers/MailgunTransport.ts'
import { Message } from '../../../src/Message.ts'
import { MailError } from '../../../src/errors/MailError.ts'

describe('MailgunTransport', () => {
  const originalFetch = globalThis.fetch
  let capturedUrl: string
  let capturedInit: RequestInit
  let capturedFormData: FormData | null
  let transport: MailgunTransport

  beforeEach(() => {
    capturedUrl = ''
    capturedInit = {}
    capturedFormData = null
    transport = new MailgunTransport({
      apiKey: 'key-mg-test-abc123',
      domain: 'mg.example.com',
    })
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  function mockFetchSuccess(responseBody: Record<string, any> = { id: '<msg-id@mg.example.com>', message: 'Queued' }) {
    globalThis.fetch = async (input: any, init?: any) => {
      capturedUrl = typeof input === 'string' ? input : input.toString()
      capturedInit = init ?? {}
      // Capture the FormData before it's consumed
      if (init?.body instanceof FormData) {
        capturedFormData = init.body
      }
      return new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  function mockFetchError(status: number, statusText: string, body: string) {
    globalThis.fetch = async (input: any, init?: any) => {
      capturedUrl = typeof input === 'string' ? input : input.toString()
      capturedInit = init ?? {}
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

  // ── Correct endpoint (US region) ────────────────────────────────────────────

  test('sends to the correct US Mailgun API endpoint', async () => {
    mockFetchSuccess()
    await transport.send(buildTestMessage())

    expect(capturedUrl).toBe('https://api.mailgun.net/v3/mg.example.com/messages')
  })

  // ── Correct endpoint (EU region) ────────────────────────────────────────────

  test('sends to the EU Mailgun API endpoint when region is eu', async () => {
    const euTransport = new MailgunTransport({
      apiKey: 'key-mg-test-abc123',
      domain: 'mg.example.com',
      region: 'eu',
    })
    mockFetchSuccess()
    await euTransport.send(buildTestMessage())

    expect(capturedUrl).toBe('https://api.eu.mailgun.net/v3/mg.example.com/messages')
  })

  // ── Correct headers ─────────────────────────────────────────────────────────

  test('sends correct Basic Authorization header', async () => {
    mockFetchSuccess()
    await transport.send(buildTestMessage())

    const headers = capturedInit.headers as Record<string, string>
    const expectedAuth = Buffer.from('api:key-mg-test-abc123').toString('base64')
    expect(headers['Authorization']).toBe(`Basic ${expectedAuth}`)
  })

  // ── Correct payload (FormData) ──────────────────────────────────────────────

  test('sends FormData with correct fields', async () => {
    mockFetchSuccess()
    await transport.send(buildTestMessage())

    expect(capturedFormData).not.toBeNull()
    expect(capturedFormData!.get('from')).toBe('Sender <sender@example.com>')
    expect(capturedFormData!.get('to')).toBe('recipient@example.com')
    expect(capturedFormData!.get('subject')).toBe('Test Email')
    expect(capturedFormData!.get('html')).toBe('<p>Hello</p>')
    expect(capturedFormData!.get('text')).toBe('Hello')
  })

  test('uses POST method', async () => {
    mockFetchSuccess()
    await transport.send(buildTestMessage())

    expect(capturedInit.method).toBe('POST')
  })

  // ── Returns { id } on success ───────────────────────────────────────────────

  test('returns { id } with angle brackets stripped', async () => {
    mockFetchSuccess({ id: '<20230101120000.abc@mg.example.com>', message: 'Queued' })
    const result = await transport.send(buildTestMessage())

    expect(result).toEqual({ id: '20230101120000.abc@mg.example.com' })
  })

  // ── Error: 401 bad API key ──────────────────────────────────────────────────

  test('throws MailError on 401 (bad API key)', async () => {
    mockFetchError(401, 'Unauthorized', 'Forbidden')

    try {
      await transport.send(buildTestMessage())
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(MailError)
      expect((err as MailError).message).toContain('Mailgun API error')
      expect((err as MailError).message).toContain('401')
    }
  })

  // ── Error: 422 validation ──────────────────────────────────────────────────

  test('throws MailError on 422 (validation error)', async () => {
    mockFetchError(422, 'Unprocessable Entity', '{"message":"to parameter is not a valid address"}')

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

  test('includes cc and bcc fields in FormData', async () => {
    mockFetchSuccess()
    const msg = buildTestMessage()
      .addCc('cc@example.com')
      .addBcc('bcc@example.com')

    await transport.send(msg)

    expect(capturedFormData!.get('cc')).toBe('cc@example.com')
    expect(capturedFormData!.get('bcc')).toBe('bcc@example.com')
  })

  // ── Attachments ─────────────────────────────────────────────────────────────

  test('includes attachments in FormData', async () => {
    mockFetchSuccess()
    const msg = buildTestMessage()
      .addAttachment('file.txt', 'Hello World', 'text/plain')

    await transport.send(msg)

    // Mailgun sends attachments as Blob entries with the key 'attachment'
    const attachment = capturedFormData!.get('attachment')
    expect(attachment).not.toBeNull()
    expect(attachment).toBeInstanceOf(File)
  })

  // ── Custom headers ──────────────────────────────────────────────────────────

  test('includes custom headers with h: prefix in FormData', async () => {
    mockFetchSuccess()
    const msg = buildTestMessage()
      .setHeader('X-Custom-Tag', 'campaign-1')

    await transport.send(msg)

    expect(capturedFormData!.get('h:X-Custom-Tag')).toBe('campaign-1')
  })

  // ── Reply-To ────────────────────────────────────────────────────────────────

  test('includes h:Reply-To in FormData', async () => {
    mockFetchSuccess()
    const msg = buildTestMessage()
      .addReplyTo('reply@example.com')

    await transport.send(msg)

    expect(capturedFormData!.get('h:Reply-To')).toBe('reply@example.com')
  })
})
