import type { MailTransport } from '../contracts/Transport.ts'
import { Message } from '../Message.ts'
import type { MailAddress } from '../contracts/MailConfig.ts'
import { MailError } from '../errors/MailError.ts'

export interface SendGridConfig {
  apiKey: string
}

export class SendGridTransport implements MailTransport {
  private config: SendGridConfig

  constructor(config: SendGridConfig) {
    this.config = config
  }

  async send(message: Message): Promise<{ id: string }> {
    const personalizations: Record<string, any> = {}

    personalizations.to = message.to.map((addr) => this.formatAddr(addr))

    if (message.cc.length > 0) {
      personalizations.cc = message.cc.map((addr) => this.formatAddr(addr))
    }

    if (message.bcc.length > 0) {
      personalizations.bcc = message.bcc.map((addr) => this.formatAddr(addr))
    }

    const body: Record<string, any> = {
      personalizations: [personalizations],
      from: this.formatAddr(message.from),
      subject: message.subject,
    }

    if (message.replyTo.length > 0) {
      const first = message.replyTo[0]
      if (first) {
        body.reply_to = this.formatAddr(first)
      }
      if (message.replyTo.length > 1) {
        body.reply_to_list = message.replyTo.map((addr) => this.formatAddr(addr))
      }
    }

    const content: { type: string; value: string }[] = []
    if (message.text !== null) {
      content.push({ type: 'text/plain', value: message.text })
    }
    if (message.html !== null) {
      content.push({ type: 'text/html', value: message.html })
    }
    if (content.length > 0) {
      body.content = content
    }

    if (message.attachments.length > 0) {
      body.attachments = message.attachments.map((attachment) => ({
        filename: attachment.filename,
        content: typeof attachment.content === 'string'
          ? Buffer.from(attachment.content).toString('base64')
          : Buffer.from(attachment.content).toString('base64'),
        type: attachment.contentType || 'application/octet-stream',
        disposition: 'attachment',
      }))
    }

    if (Object.keys(message.headers).length > 0) {
      body.headers = message.headers
    }

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new MailError(`SendGrid API error: ${response.status} ${response.statusText}`, {
        status: response.status,
        body: errorBody,
      })
    }

    // SendGrid returns the message ID in the x-message-id header
    const messageId = response.headers.get('x-message-id')

    return { id: messageId || crypto.randomUUID() }
  }

  private formatAddr(addr: MailAddress): { email: string; name?: string } {
    const result: { email: string; name?: string } = { email: addr.address }
    if (addr.name) {
      result.name = addr.name
    }
    return result
  }
}
