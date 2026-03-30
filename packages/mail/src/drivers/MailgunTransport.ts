import type { MailTransport } from '../contracts/Transport.ts'
import { Message } from '../Message.ts'
import { MailError } from '../errors/MailError.ts'

export interface MailgunConfig {
  apiKey: string
  domain: string
  region?: 'us' | 'eu'
}

export class MailgunTransport implements MailTransport {
  private config: MailgunConfig

  constructor(config: MailgunConfig) {
    this.config = config
  }

  async send(message: Message): Promise<{ id: string }> {
    const baseUrl = this.config.region === 'eu'
      ? 'https://api.eu.mailgun.net'
      : 'https://api.mailgun.net'

    const url = `${baseUrl}/v3/${this.config.domain}/messages`

    const formData = new FormData()

    formData.append('from', Message.formatAddress(message.from))

    for (const addr of message.to) {
      formData.append('to', Message.formatAddress(addr))
    }

    for (const addr of message.cc) {
      formData.append('cc', Message.formatAddress(addr))
    }

    for (const addr of message.bcc) {
      formData.append('bcc', Message.formatAddress(addr))
    }

    formData.append('subject', message.subject)

    if (message.html !== null) {
      formData.append('html', message.html)
    }

    if (message.text !== null) {
      formData.append('text', message.text)
    }

    if (message.replyTo.length > 0) {
      formData.append('h:Reply-To', Message.formatAddresses(message.replyTo))
    }

    // Custom headers
    for (const [key, value] of Object.entries(message.headers)) {
      formData.append(`h:${key}`, value)
    }

    // Attachments
    for (const attachment of message.attachments) {
      const content = new Blob([attachment.content as any], {
        type: attachment.contentType || 'application/octet-stream',
      })
      formData.append('attachment', content, attachment.filename)
    }

    const authString = Buffer.from(`api:${this.config.apiKey}`).toString('base64')

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new MailError(`Mailgun API error: ${response.status} ${response.statusText}`, {
        status: response.status,
        body: errorBody,
      })
    }

    const result = await response.json() as { id: string; message: string }

    // Mailgun returns id wrapped in angle brackets like "<id@domain>"
    const id = result.id ? result.id.replace(/[<>]/g, '') : crypto.randomUUID()

    return { id }
  }
}
