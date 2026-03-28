import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { SesTransport } from '../../../src/drivers/SesTransport.ts'
import { Message } from '../../../src/Message.ts'
import { MailError } from '../../../src/errors/MailError.ts'

describe('SesTransport', () => {
  const originalFetch = globalThis.fetch
  let capturedRequest: { url: string; init: RequestInit } | null
  let transport: SesTransport

  beforeEach(() => {
    capturedRequest = null
    transport = new SesTransport({
      region: 'us-east-1',
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    })
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  function mockFetchSuccess(responseBody: Record<string, any> = { MessageId: 'ses-msg-id-789' }) {
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

  test('sends to the correct SES v2 API endpoint with region', async () => {
    mockFetchSuccess()
    await transport.send(buildTestMessage())

    expect(capturedRequest!.url).toBe('https://email.us-east-1.amazonaws.com/v2/email/outbound-emails')
  })

  test('uses the configured region in the endpoint', async () => {
    const euTransport = new SesTransport({
      region: 'eu-west-1',
      accessKeyId: 'AKID',
      secretAccessKey: 'SECRET',
    })
    mockFetchSuccess()
    await euTransport.send(buildTestMessage())

    expect(capturedRequest!.url).toBe('https://email.eu-west-1.amazonaws.com/v2/email/outbound-emails')
  })

  // ── Correct headers ─────────────────────────────────────────────────────────

  test('sends Content-Type, X-Amz-Date, and Authorization headers', async () => {
    mockFetchSuccess()
    await transport.send(buildTestMessage())

    const headers = capturedRequest!.init.headers as Record<string, string>
    expect(headers['Content-Type']).toBe('application/json')
    expect(headers['X-Amz-Date']).toMatch(/^\d{8}T\d{6}Z$/)
    expect(headers['Authorization']).toContain('AWS4-HMAC-SHA256')
    expect(headers['Authorization']).toContain('Credential=AKIAIOSFODNN7EXAMPLE/')
    expect(headers['Authorization']).toContain('SignedHeaders=content-type;host;x-amz-date')
    expect(headers['Authorization']).toContain('Signature=')
  })

  // ── Correct payload ─────────────────────────────────────────────────────────

  test('sends correct SES v2 payload shape', async () => {
    mockFetchSuccess()
    await transport.send(buildTestMessage())

    const body = JSON.parse(capturedRequest!.init.body as string)
    expect(body.FromEmailAddress).toBe('Sender <sender@example.com>')
    expect(body.Destination.ToAddresses).toEqual(['recipient@example.com'])
    expect(body.Content.Simple.Subject).toEqual({ Data: 'Test Email', Charset: 'UTF-8' })
    expect(body.Content.Simple.Body.Html).toEqual({ Data: '<p>Hello</p>', Charset: 'UTF-8' })
    expect(body.Content.Simple.Body.Text).toEqual({ Data: 'Hello', Charset: 'UTF-8' })
  })

  // ── Returns { id } on success ───────────────────────────────────────────────

  test('returns { id } from MessageId in response', async () => {
    mockFetchSuccess({ MessageId: 'ses-unique-abc' })
    const result = await transport.send(buildTestMessage())

    expect(result).toEqual({ id: 'ses-unique-abc' })
  })

  // ── Error: 401/403 bad credentials ──────────────────────────────────────────

  test('throws MailError on 401 (bad credentials)', async () => {
    mockFetchError(401, 'Unauthorized', '<ErrorResponse><Error><Code>InvalidClientTokenId</Code></Error></ErrorResponse>')

    try {
      await transport.send(buildTestMessage())
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(MailError)
      expect((err as MailError).message).toContain('AWS SES API error')
      expect((err as MailError).message).toContain('401')
    }
  })

  // ── Error: 422 validation ──────────────────────────────────────────────────

  test('throws MailError on 400 (validation error)', async () => {
    mockFetchError(400, 'Bad Request', '{"message":"Email address is not verified."}')

    try {
      await transport.send(buildTestMessage())
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(MailError)
      expect((err as MailError).message).toContain('400')
    }
  })

  // ── Error: 429 rate limited ─────────────────────────────────────────────────

  test('throws MailError on 429 (rate limited)', async () => {
    mockFetchError(429, 'Too Many Requests', '<ErrorResponse><Error><Code>Throttling</Code></Error></ErrorResponse>')

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

  test('includes CcAddresses and BccAddresses in Destination', async () => {
    mockFetchSuccess()
    const msg = buildTestMessage()
      .addCc({ address: 'cc@example.com', name: 'CC User' })
      .addBcc('bcc@example.com')

    await transport.send(msg)

    const body = JSON.parse(capturedRequest!.init.body as string)
    expect(body.Destination.CcAddresses).toEqual(['CC User <cc@example.com>'])
    expect(body.Destination.BccAddresses).toEqual(['bcc@example.com'])
  })

  // ── ReplyTo ─────────────────────────────────────────────────────────────────

  test('includes ReplyToAddresses in the payload', async () => {
    mockFetchSuccess()
    const msg = buildTestMessage()
      .addReplyTo('reply@example.com')

    await transport.send(msg)

    const body = JSON.parse(capturedRequest!.init.body as string)
    expect(body.ReplyToAddresses).toEqual(['reply@example.com'])
  })

  // ── Custom headers mapped to EmailTags ──────────────────────────────────────

  test('includes custom headers as EmailTags', async () => {
    mockFetchSuccess()
    const msg = buildTestMessage()
      .setHeader('X-Campaign-Id', 'abc')

    await transport.send(msg)

    const body = JSON.parse(capturedRequest!.init.body as string)
    expect(body.EmailTags).toEqual([{ Name: 'X-Campaign-Id', Value: 'abc' }])
  })

  // ── AWS Signature V4 structure ──────────────────────────────────────────────

  test('Authorization header follows AWS Signature V4 format', async () => {
    mockFetchSuccess()
    await transport.send(buildTestMessage())

    const headers = capturedRequest!.init.headers as Record<string, string>
    const authHeader = headers['Authorization']

    // Format: AWS4-HMAC-SHA256 Credential=<key>/<date>/<region>/ses/aws4_request, SignedHeaders=..., Signature=...
    expect(authHeader).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE\/\d{8}\/us-east-1\/ses\/aws4_request/)
    expect(authHeader).toContain('SignedHeaders=content-type;host;x-amz-date')
    expect(authHeader).toMatch(/Signature=[0-9a-f]{64}$/)
  })
})
