import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { SmtpTransport } from '../../../src/drivers/SmtpTransport.ts'
import { Message } from '../../../src/Message.ts'
import { MailError } from '../../../src/errors/MailError.ts'

/**
 * Creates a mock TCP socket that simulates an SMTP server conversation.
 * `responses` is a list of SMTP responses that will be returned in order
 * whenever the client sends a command (writes to the socket).
 *
 * The mock intercepts `Bun.connect` and replays responses through the
 * socket's `data` callback.
 */
function createSmtpMock(responses: string[]) {
  const written: string[] = []
  let responseIndex = 0
  let dataCallback: ((socket: any, data: Buffer) => void) | null = null
  let openCallback: (() => void) | null = null
  let connectOptions: any = null

  const mockSocket = {
    write(data: string) {
      written.push(data)
      // After each write, deliver the next queued server response
      if (dataCallback && responseIndex < responses.length) {
        const resp = responses[responseIndex++]!
        // Simulate async delivery via queueMicrotask
        queueMicrotask(() => {
          dataCallback!(mockSocket, Buffer.from(resp))
        })
      }
    },
    end() {
      // no-op
    },
  }

  const originalConnect = Bun.connect

  // Patch Bun.connect
  ;(Bun as any).connect = async (options: any) => {
    connectOptions = options
    dataCallback = options.socket.data
    openCallback = options.socket.open

    // Deliver the greeting (first response) after "connecting"
    if (responses.length > 0 && responseIndex < responses.length) {
      const greeting = responses[responseIndex++]!
      queueMicrotask(() => {
        if (openCallback) openCallback()
        dataCallback!(mockSocket, Buffer.from(greeting))
      })
    }

    return mockSocket
  }

  return {
    written,
    mockSocket,
    get connectOptions() { return connectOptions },
    restore() {
      ;(Bun as any).connect = originalConnect
    },
  }
}

describe('SmtpTransport', () => {
  // Standard successful SMTP conversation responses
  const STANDARD_RESPONSES = [
    '220 smtp.example.com ESMTP\r\n',           // greeting
    '250-smtp.example.com\r\n250 OK\r\n',       // EHLO
    '235 2.7.0 Authentication successful\r\n',   // AUTH PLAIN
    '250 2.1.0 OK\r\n',                          // MAIL FROM
    '250 2.1.5 OK\r\n',                          // RCPT TO
    '354 Start mail input\r\n',                   // DATA
    '250 2.0.0 OK queued as ABC123\r\n',         // message body
    '221 2.0.0 Bye\r\n',                          // QUIT
  ]

  let mock: ReturnType<typeof createSmtpMock>

  afterEach(() => {
    if (mock) mock.restore()
  })

  function buildTestMessage(): Message {
    return new Message()
      .setFrom({ address: 'sender@example.com', name: 'Sender' })
      .addTo('recipient@example.com')
      .setSubject('Test Email')
      .setHtml('<p>Hello</p>')
      .setText('Hello')
  }

  // ── EHLO handshake ──────────────────────────────────────────────────────────

  test('sends EHLO localhost after connecting', async () => {
    mock = createSmtpMock(STANDARD_RESPONSES)
    const transport = new SmtpTransport({
      host: 'smtp.example.com',
      port: 587,
      username: 'user',
      password: 'pass',
    })

    await transport.send(buildTestMessage())

    expect(mock.written[0]).toBe('EHLO localhost\r\n')
  })

  // ── AUTH PLAIN sequence ─────────────────────────────────────────────────────

  test('sends AUTH PLAIN with base64-encoded credentials', async () => {
    mock = createSmtpMock(STANDARD_RESPONSES)
    const transport = new SmtpTransport({
      host: 'smtp.example.com',
      port: 587,
      username: 'user@example.com',
      password: 's3cret',
    })

    await transport.send(buildTestMessage())

    const authCmd = mock.written[1]!
    expect(authCmd).toContain('AUTH PLAIN ')
    // Verify credentials are base64-encoded: \0username\0password
    const credentialsPart = authCmd.replace('AUTH PLAIN ', '').replace('\r\n', '')
    const decoded = Buffer.from(credentialsPart, 'base64').toString()
    expect(decoded).toBe('\0user@example.com\0s3cret')
  })

  // ── AUTH LOGIN fallback ─────────────────────────────────────────────────────

  test('falls back to AUTH LOGIN when AUTH PLAIN is rejected', async () => {
    const loginResponses = [
      '220 smtp.example.com ESMTP\r\n',           // greeting
      '250 OK\r\n',                                // EHLO
      '535 5.7.8 Authentication failed\r\n',       // AUTH PLAIN rejected
      '334 VXNlcm5hbWU6\r\n',                     // AUTH LOGIN prompt (Username:)
      '334 UGFzc3dvcmQ6\r\n',                     // password prompt (Password:)
      '235 2.7.0 Authentication successful\r\n',   // AUTH LOGIN success
      '250 2.1.0 OK\r\n',                          // MAIL FROM
      '250 2.1.5 OK\r\n',                          // RCPT TO
      '354 Start mail input\r\n',                   // DATA
      '250 2.0.0 OK queued as DEF456\r\n',         // message body
      '221 Bye\r\n',                                // QUIT
    ]
    mock = createSmtpMock(loginResponses)
    const transport = new SmtpTransport({
      host: 'smtp.example.com',
      port: 587,
      username: 'user@example.com',
      password: 's3cret',
    })

    await transport.send(buildTestMessage())

    // After AUTH PLAIN fails: AUTH LOGIN, base64(username), base64(password)
    expect(mock.written).toContain('AUTH LOGIN\r\n')
    expect(mock.written).toContain(`${Buffer.from('user@example.com').toString('base64')}\r\n`)
    expect(mock.written).toContain(`${Buffer.from('s3cret').toString('base64')}\r\n`)
  })

  // ── MAIL FROM / RCPT TO / DATA sequence ─────────────────────────────────────

  test('sends MAIL FROM, RCPT TO, and DATA commands in correct order', async () => {
    mock = createSmtpMock(STANDARD_RESPONSES)
    const transport = new SmtpTransport({
      host: 'smtp.example.com',
      port: 587,
      username: 'user',
      password: 'pass',
    })

    await transport.send(buildTestMessage())

    // written[0] = EHLO, written[1] = AUTH PLAIN, written[2] = MAIL FROM, written[3] = RCPT TO, written[4] = DATA
    expect(mock.written[2]).toBe('MAIL FROM:<sender@example.com>\r\n')
    expect(mock.written[3]).toBe('RCPT TO:<recipient@example.com>\r\n')
    expect(mock.written[4]).toBe('DATA\r\n')
  })

  // ── Message body in RFC 2822 format ─────────────────────────────────────────

  test('sends message body with RFC 2822 headers', async () => {
    mock = createSmtpMock(STANDARD_RESPONSES)
    const transport = new SmtpTransport({
      host: 'smtp.example.com',
      port: 587,
      username: 'user',
      password: 'pass',
    })

    await transport.send(buildTestMessage())

    // written[5] = raw message body, written[6] = \r\n.\r\n
    const rawMessage = mock.written[5]!
    expect(rawMessage).toContain('From: Sender <sender@example.com>')
    expect(rawMessage).toContain('To: recipient@example.com')
    expect(rawMessage).toContain('Subject: Test Email')
    expect(rawMessage).toContain('MIME-Version: 1.0')
    expect(rawMessage).toContain('Message-ID: <')

    // The terminating dot sequence
    expect(mock.written[6]).toBe('\r\n.\r\n')
  })

  // ── TLS connection ──────────────────────────────────────────────────────────

  test('requests TLS when encryption is tls', async () => {
    mock = createSmtpMock(STANDARD_RESPONSES)
    const transport = new SmtpTransport({
      host: 'smtp.example.com',
      port: 465,
      username: 'user',
      password: 'pass',
      encryption: 'tls',
    })

    await transport.send(buildTestMessage())

    expect(mock.connectOptions.tls).toBe(true)
  })

  // ── STARTTLS upgrade ────────────────────────────────────────────────────────

  test('sends STARTTLS and re-issues EHLO when encryption is starttls', async () => {
    const starttlsResponses = [
      '220 smtp.example.com ESMTP\r\n',           // greeting
      '250 OK\r\n',                                // EHLO
      '220 2.0.0 Ready to start TLS\r\n',         // STARTTLS
      '250 OK\r\n',                                // re-EHLO after TLS
      '235 2.7.0 Authentication successful\r\n',   // AUTH PLAIN
      '250 2.1.0 OK\r\n',                          // MAIL FROM
      '250 2.1.5 OK\r\n',                          // RCPT TO
      '354 Start mail input\r\n',                   // DATA
      '250 2.0.0 OK queued as GHI789\r\n',         // message body
      '221 Bye\r\n',                                // QUIT
    ]
    mock = createSmtpMock(starttlsResponses)
    const transport = new SmtpTransport({
      host: 'smtp.example.com',
      port: 587,
      username: 'user',
      password: 'pass',
      encryption: 'starttls',
    })

    await transport.send(buildTestMessage())

    // EHLO, STARTTLS, re-EHLO
    expect(mock.written[0]).toBe('EHLO localhost\r\n')
    expect(mock.written[1]).toBe('STARTTLS\r\n')
    expect(mock.written[2]).toBe('EHLO localhost\r\n')
  })

  // ── Auth failure → clear error ──────────────────────────────────────────────

  test('throws MailError when both AUTH PLAIN and AUTH LOGIN fail', async () => {
    const authFailResponses = [
      '220 smtp.example.com ESMTP\r\n',           // greeting
      '250 OK\r\n',                                // EHLO
      '535 5.7.8 Authentication failed\r\n',       // AUTH PLAIN rejected
      '334 VXNlcm5hbWU6\r\n',                     // AUTH LOGIN prompt
      '334 UGFzc3dvcmQ6\r\n',                     // password prompt
      '535 5.7.8 Authentication failed\r\n',       // AUTH LOGIN also fails
    ]
    mock = createSmtpMock(authFailResponses)
    const transport = new SmtpTransport({
      host: 'smtp.example.com',
      port: 587,
      username: 'bad-user',
      password: 'bad-pass',
    })

    try {
      await transport.send(buildTestMessage())
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(MailError)
      expect((err as MailError).message).toContain('SMTP')
      expect((err as MailError).message).toContain('AUTH LOGIN password')
    }
  })

  // ── Server disconnect (connection error) → error ────────────────────────────

  test('throws MailError when Bun.connect rejects (server unreachable)', async () => {
    const originalConnect = Bun.connect
    ;(Bun as any).connect = async () => {
      throw new Error('Connection refused')
    }

    const transport = new SmtpTransport({
      host: 'unreachable.example.com',
      port: 587,
    })

    try {
      await transport.send(buildTestMessage())
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(MailError)
      expect((err as MailError).message).toContain('SMTP transport error')
      expect((err as MailError).message).toContain('Connection refused')
    } finally {
      ;(Bun as any).connect = originalConnect
    }
  })

  // ── No auth when credentials not provided ───────────────────────────────────

  test('skips AUTH when username and password are not provided', async () => {
    const noAuthResponses = [
      '220 smtp.example.com ESMTP\r\n',           // greeting
      '250 OK\r\n',                                // EHLO
      '250 2.1.0 OK\r\n',                          // MAIL FROM (no auth step)
      '250 2.1.5 OK\r\n',                          // RCPT TO
      '354 Start mail input\r\n',                   // DATA
      '250 2.0.0 OK queued as JKL012\r\n',         // message body
      '221 Bye\r\n',                                // QUIT
    ]
    mock = createSmtpMock(noAuthResponses)
    const transport = new SmtpTransport({
      host: 'smtp.example.com',
      port: 25,
    })

    await transport.send(buildTestMessage())

    // After EHLO, should go straight to MAIL FROM (no AUTH command)
    expect(mock.written[1]).toBe('MAIL FROM:<sender@example.com>\r\n')
  })

  // ── RCPT TO for cc and bcc ──────────────────────────────────────────────────

  test('sends RCPT TO for all recipients including cc and bcc', async () => {
    const multiRcptResponses = [
      '220 smtp.example.com ESMTP\r\n',
      '250 OK\r\n',
      '250 2.1.0 OK\r\n',                          // MAIL FROM
      '250 2.1.5 OK\r\n',                          // RCPT TO (to)
      '250 2.1.5 OK\r\n',                          // RCPT TO (cc)
      '250 2.1.5 OK\r\n',                          // RCPT TO (bcc)
      '354 Start mail input\r\n',
      '250 2.0.0 OK queued as MNO345\r\n',
      '221 Bye\r\n',
    ]
    mock = createSmtpMock(multiRcptResponses)
    const transport = new SmtpTransport({
      host: 'smtp.example.com',
      port: 25,
    })

    const msg = buildTestMessage()
      .addCc('cc@example.com')
      .addBcc('bcc@example.com')

    await transport.send(msg)

    expect(mock.written).toContain('RCPT TO:<recipient@example.com>\r\n')
    expect(mock.written).toContain('RCPT TO:<cc@example.com>\r\n')
    expect(mock.written).toContain('RCPT TO:<bcc@example.com>\r\n')
  })

  // ── QUIT is sent at the end ─────────────────────────────────────────────────

  test('sends QUIT command after the message is sent', async () => {
    mock = createSmtpMock(STANDARD_RESPONSES)
    const transport = new SmtpTransport({
      host: 'smtp.example.com',
      port: 587,
      username: 'user',
      password: 'pass',
    })

    await transport.send(buildTestMessage())

    const lastCmd = mock.written[mock.written.length - 1]!
    expect(lastCmd).toBe('QUIT\r\n')
  })

  // ── Returns { id } ──────────────────────────────────────────────────────────

  test('returns message id from server response', async () => {
    mock = createSmtpMock(STANDARD_RESPONSES)
    const transport = new SmtpTransport({
      host: 'smtp.example.com',
      port: 587,
      username: 'user',
      password: 'pass',
    })

    const result = await transport.send(buildTestMessage())

    // The server response "250 2.0.0 OK queued as ABC123" should extract "ABC123"
    expect(result.id).toBe('ABC123')
  })

  // ── Cc in raw message headers ───────────────────────────────────────────────

  test('includes Cc header in raw message but not Bcc', async () => {
    const multiRcptResponses = [
      '220 smtp.example.com ESMTP\r\n',
      '250 OK\r\n',
      '250 2.1.0 OK\r\n',
      '250 2.1.5 OK\r\n',
      '250 2.1.5 OK\r\n',
      '250 2.1.5 OK\r\n',
      '354 Start mail input\r\n',
      '250 2.0.0 OK queued as PQR678\r\n',
      '221 Bye\r\n',
    ]
    mock = createSmtpMock(multiRcptResponses)
    const transport = new SmtpTransport({
      host: 'smtp.example.com',
      port: 25,
    })

    const msg = buildTestMessage()
      .addCc('cc@example.com')
      .addBcc('bcc@example.com')

    await transport.send(msg)

    // Find the raw message in written data (the one that has "From:" header)
    const rawMessage = mock.written.find(w => w.includes('From:'))!
    expect(rawMessage).toContain('Cc: cc@example.com')
    // BCC should NOT appear in headers (per RFC)
    expect(rawMessage).not.toContain('Bcc:')
  })

  // ── MAIL FROM error ─────────────────────────────────────────────────────────

  test('throws MailError when MAIL FROM is rejected', async () => {
    const failResponses = [
      '220 smtp.example.com ESMTP\r\n',
      '250 OK\r\n',
      '550 5.1.8 Sender address rejected\r\n',     // MAIL FROM rejected
    ]
    mock = createSmtpMock(failResponses)
    const transport = new SmtpTransport({
      host: 'smtp.example.com',
      port: 25,
    })

    try {
      await transport.send(buildTestMessage())
      expect.unreachable('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(MailError)
      expect((err as MailError).message).toContain('MAIL FROM')
      expect((err as MailError).message).toContain('550')
    }
  })
})
