import type { MailTransport } from '../contracts/Transport.ts'
import { Message } from '../Message.ts'
import { MailError } from '../errors/MailError.ts'

export interface ResendConfig {
  apiKey: string
}

export class ResendTransport implements MailTransport {
  private config: ResendConfig

  constructor(config: ResendConfig) {
    this.config = config
  }

  async send(message: Message): Promise<{ id: string }> {
    const body: Record<string, any> = {
      from: Message.formatAddress(message.from),
      to: message.to.map((addr) => Message.formatAddress(addr)),
      subject: message.subject,
    }

    if (message.cc.length > 0) {
      body.cc = message.cc.map((addr) => Message.formatAddress(addr))
    }

    if (message.bcc.length > 0) {
      body.bcc = message.bcc.map((addr) => Message.formatAddress(addr))
    }

    if (message.replyTo.length > 0) {
      body.reply_to = message.replyTo.map((addr) => Message.formatAddress(addr))
    }

    if (message.html !== null) {
      body.html = message.html
    }

    if (message.text !== null) {
      body.text = message.text
    }

    if (message.attachments.length > 0) {
      body.attachments = message.attachments.map((attachment) => ({
        filename: attachment.filename,
        content: typeof attachment.content === 'string'
          ? Buffer.from(attachment.content).toString('base64')
          : Buffer.from(attachment.content).toString('base64'),
        type: attachment.contentType || 'application/octet-stream',
      }))
    }

    if (Object.keys(message.headers).length > 0) {
      body.headers = message.headers
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new MailError(`Resend API error: ${response.status} ${response.statusText}`, {
        status: response.status,
        body: errorBody,
      })
    }

    const result = await response.json() as { id: string }

    return { id: result.id }
  }
}
