import type { MailTransport } from '../contracts/Transport.ts'
import { Message, type Attachment } from '../Message.ts'
import { MailError } from '../errors/MailError.ts'

export interface SmtpConfig {
  host: string
  port: number
  username?: string
  password?: string
  encryption?: 'tls' | 'starttls' | 'none'
}

export class SmtpTransport implements MailTransport {
  private config: SmtpConfig

  constructor(config: SmtpConfig) {
    this.config = config
  }

  /**
   * Security: validate that a value contains no CR, LF, or null bytes
   * to prevent SMTP header/command injection.
   */
  private assertNoInjection(value: string, field: string): void {
    if (/[\r\n\0]/.test(value)) {
      throw new MailError(
        `SMTP injection detected in ${field}: value contains CR, LF, or null bytes`,
      )
    }
  }

  /**
   * Security: sanitize a subject line by stripping CR/LF characters
   * to prevent SMTP header injection. Per RFC 2047, subjects should
   * not contain bare newlines.
   */
  private sanitizeSubject(subject: string): string {
    return subject.replace(/[\r\n\0]/g, '')
  }

  async send(message: Message): Promise<{ id: string }> {
    const { host, port, username, password, encryption = 'none' } = this.config

    let socket: ReturnType<typeof Bun.connect> extends Promise<infer T> ? T : never
    let responseBuffer = ''
    let responseResolve: ((value: string) => void) | null = null

    const waitForResponse = (): Promise<string> => {
      return new Promise((resolve) => {
        if (responseBuffer.length > 0) {
          // Check if we have a complete response
          const complete = this.extractCompleteResponse(responseBuffer)
          if (complete) {
            responseBuffer = responseBuffer.slice(complete.length)
            resolve(complete)
            return
          }
        }
        responseResolve = resolve
      })
    }

    const handleData = (data: Buffer) => {
      responseBuffer += data.toString()
      if (responseResolve) {
        const complete = this.extractCompleteResponse(responseBuffer)
        if (complete) {
          responseBuffer = responseBuffer.slice(complete.length)
          const resolve = responseResolve
          responseResolve = null
          resolve(complete)
        }
      }
    }

    try {
      const useTls = encryption === 'tls'

      const socketOptions = {
        hostname: host,
        port,
        socket: {
          data(_socket: any, data: Buffer) {
            handleData(data)
          },
          error(_socket: any, error: Error) {
            throw new MailError(`SMTP socket error: ${error.message}`)
          },
          close() {
            // Connection closed
          },
          open() {
            // Connection opened
          },
        },
      } as any

      if (useTls) {
        socketOptions.tls = true
      }

      socket = await Bun.connect(socketOptions)

      // Read greeting
      const greeting = await waitForResponse()
      this.assertCode(greeting, 220, 'greeting')

      // EHLO
      socket.write(`EHLO localhost\r\n`)
      const ehlo = await waitForResponse()
      this.assertCode(ehlo, 250, 'EHLO')

      // STARTTLS if needed
      if (encryption === 'starttls') {
        socket.write(`STARTTLS\r\n`)
        const starttls = await waitForResponse()
        this.assertCode(starttls, 220, 'STARTTLS')

        // Upgrade to TLS — Bun's socket supports upgradeToTLS (if available)
        // For environments where upgradeToTLS isn't available, we rely on the
        // initial TLS connection (encryption: 'tls') instead.
        // @ts-expect-error — upgradeToTLS may or may not exist on the socket
        if (typeof socket.upgradeToTLS === 'function') {
          // @ts-expect-error
          socket = await socket.upgradeToTLS()
        }

        // Re-EHLO after STARTTLS
        socket.write(`EHLO localhost\r\n`)
        const ehlo2 = await waitForResponse()
        this.assertCode(ehlo2, 250, 'EHLO after STARTTLS')
      }

      // AUTH if credentials provided
      if (username && password) {
        // Try AUTH PLAIN first
        const credentials = Buffer.from(`\0${username}\0${password}`).toString('base64')
        socket.write(`AUTH PLAIN ${credentials}\r\n`)
        const authResp = await waitForResponse()

        if (!authResp.startsWith('235')) {
          // Fall back to AUTH LOGIN
          socket.write(`AUTH LOGIN\r\n`)
          const loginPrompt = await waitForResponse()
          this.assertCode(loginPrompt, 334, 'AUTH LOGIN')

          socket.write(`${Buffer.from(username).toString('base64')}\r\n`)
          const userPrompt = await waitForResponse()
          this.assertCode(userPrompt, 334, 'AUTH LOGIN username')

          socket.write(`${Buffer.from(password).toString('base64')}\r\n`)
          const passResp = await waitForResponse()
          this.assertCode(passResp, 235, 'AUTH LOGIN password')
        }
      }

      // Security: validate all email addresses against SMTP injection
      this.assertNoInjection(message.from.address, 'from address')
      const allRecipients = [...message.to, ...message.cc, ...message.bcc]
      for (const recipient of allRecipients) {
        this.assertNoInjection(recipient.address, 'recipient address')
      }

      // MAIL FROM
      socket.write(`MAIL FROM:<${message.from.address}>\r\n`)
      const mailFrom = await waitForResponse()
      this.assertCode(mailFrom, 250, 'MAIL FROM')

      // RCPT TO — all recipients
      for (const recipient of allRecipients) {
        socket.write(`RCPT TO:<${recipient.address}>\r\n`)
        const rcpt = await waitForResponse()
        this.assertCode(rcpt, 250, 'RCPT TO')
      }

      // DATA
      socket.write(`DATA\r\n`)
      const dataResp = await waitForResponse()
      this.assertCode(dataResp, 354, 'DATA')

      // Build RFC 2822 message
      const messageId = `<${crypto.randomUUID()}@${host}>`
      const rawMessage = this.buildRawMessage(message, messageId)

      // Send the message body, ending with \r\n.\r\n
      socket.write(rawMessage)
      socket.write(`\r\n.\r\n`)
      const sendResp = await waitForResponse()
      this.assertCode(sendResp, 250, 'message send')

      // Extract message ID from server response if available
      const serverIdMatch = sendResp.match(/queued as ([^\s>]+)/i)
      const id = serverIdMatch?.[1] ?? messageId.replace(/[<>]/g, '')

      // QUIT
      socket.write(`QUIT\r\n`)
      // Don't wait for QUIT response — some servers close immediately

      socket.end()

      return { id }
    } catch (error) {
      if (error instanceof MailError) throw error
      throw new MailError(`SMTP transport error: ${(error as Error).message}`, {
        host,
        port,
      })
    }
  }

  /**
   * Extract a complete SMTP response from the buffer.
   * Multi-line responses use "XXX-" continuation and end with "XXX ".
   */
  private extractCompleteResponse(buffer: string): string | null {
    const lines = buffer.split('\r\n')
    let result = ''

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] as string
      if (line === '' && i === lines.length - 1) break // trailing empty from split

      result += line + '\r\n'

      // A line like "250 OK" (code + space) signals the final line
      if (/^\d{3} /.test(line)) {
        return result
      }
      // A line like "250-..." means continuation, keep reading
      if (/^\d{3}-/.test(line)) {
        continue
      }
    }

    return null
  }

  private assertCode(response: string, expected: number, step: string): void {
    const code = parseInt(response.substring(0, 3), 10)
    if (code !== expected) {
      throw new MailError(
        `SMTP ${step} failed: expected ${expected}, got ${code}`,
        { response: response.trim() },
      )
    }
  }

  private buildRawMessage(message: Message, messageId: string): string {
    const lines: string[] = []
    const boundary = `----=_Part_${crypto.randomUUID().replace(/-/g, '')}`

    // Headers
    lines.push(`Message-ID: ${messageId}`)
    lines.push(`Date: ${new Date().toUTCString()}`)
    lines.push(`From: ${Message.formatAddress(message.from)}`)
    lines.push(`To: ${Message.formatAddresses(message.to)}`)

    if (message.cc.length > 0) {
      lines.push(`Cc: ${Message.formatAddresses(message.cc)}`)
    }

    if (message.replyTo.length > 0) {
      lines.push(`Reply-To: ${Message.formatAddresses(message.replyTo)}`)
    }

    // Security: sanitize subject to prevent SMTP header injection
    lines.push(`Subject: ${this.sanitizeSubject(message.subject)}`)
    lines.push(`MIME-Version: 1.0`)

    // Custom headers — validate against SMTP header injection
    for (const [key, value] of Object.entries(message.headers)) {
      this.assertNoInjection(key, 'custom header name')
      this.assertNoInjection(value, `custom header '${key}'`)
      lines.push(`${key}: ${value}`)
    }

    const hasAttachments = message.attachments.length > 0
    const hasMultipleBodies = message.html !== null && message.text !== null

    if (hasAttachments) {
      lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`)
      lines.push('')
      lines.push(`--${boundary}`)

      if (hasMultipleBodies) {
        const altBoundary = `----=_Alt_${crypto.randomUUID().replace(/-/g, '')}`
        lines.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`)
        lines.push('')

        if (message.text !== null) {
          lines.push(`--${altBoundary}`)
          lines.push(`Content-Type: text/plain; charset=utf-8`)
          lines.push(`Content-Transfer-Encoding: 7bit`)
          lines.push('')
          lines.push(message.text)
        }

        if (message.html !== null) {
          lines.push(`--${altBoundary}`)
          lines.push(`Content-Type: text/html; charset=utf-8`)
          lines.push(`Content-Transfer-Encoding: 7bit`)
          lines.push('')
          lines.push(message.html)
        }

        lines.push(`--${altBoundary}--`)
      } else if (message.html !== null) {
        lines.push(`Content-Type: text/html; charset=utf-8`)
        lines.push(`Content-Transfer-Encoding: 7bit`)
        lines.push('')
        lines.push(message.html)
      } else if (message.text !== null) {
        lines.push(`Content-Type: text/plain; charset=utf-8`)
        lines.push(`Content-Transfer-Encoding: 7bit`)
        lines.push('')
        lines.push(message.text)
      }

      // Attachments
      for (const attachment of message.attachments) {
        lines.push(`--${boundary}`)
        const contentType = attachment.contentType || 'application/octet-stream'
        lines.push(`Content-Type: ${contentType}; name="${attachment.filename}"`)
        lines.push(`Content-Disposition: attachment; filename="${attachment.filename}"`)
        lines.push(`Content-Transfer-Encoding: base64`)
        lines.push('')
        lines.push(this.encodeAttachment(attachment))
      }

      lines.push(`--${boundary}--`)
    } else if (hasMultipleBodies) {
      const altBoundary = `----=_Alt_${crypto.randomUUID().replace(/-/g, '')}`
      lines.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`)
      lines.push('')

      if (message.text !== null) {
        lines.push(`--${altBoundary}`)
        lines.push(`Content-Type: text/plain; charset=utf-8`)
        lines.push(`Content-Transfer-Encoding: 7bit`)
        lines.push('')
        lines.push(message.text)
      }

      if (message.html !== null) {
        lines.push(`--${altBoundary}`)
        lines.push(`Content-Type: text/html; charset=utf-8`)
        lines.push(`Content-Transfer-Encoding: 7bit`)
        lines.push('')
        lines.push(message.html)
      }

      lines.push(`--${altBoundary}--`)
    } else if (message.html !== null) {
      lines.push(`Content-Type: text/html; charset=utf-8`)
      lines.push(`Content-Transfer-Encoding: 7bit`)
      lines.push('')
      lines.push(message.html)
    } else {
      lines.push(`Content-Type: text/plain; charset=utf-8`)
      lines.push(`Content-Transfer-Encoding: 7bit`)
      lines.push('')
      lines.push(message.text || '')
    }

    return lines.join('\r\n')
  }

  private encodeAttachment(attachment: Attachment): string {
    if (typeof attachment.content === 'string') {
      return Buffer.from(attachment.content).toString('base64')
    }
    return Buffer.from(attachment.content).toString('base64')
  }
}
