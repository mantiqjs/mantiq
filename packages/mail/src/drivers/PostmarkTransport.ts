import type { MailTransport } from '../contracts/Transport.ts'
import { Message } from '../Message.ts'
import { MailError } from '../errors/MailError.ts'

export interface PostmarkConfig {
  serverToken: string
}

export class PostmarkTransport implements MailTransport {
  private config: PostmarkConfig

  constructor(config: PostmarkConfig) {
    this.config = config
  }

  async send(message: Message): Promise<{ id: string }> {
    const body: Record<string, any> = {
      From: Message.formatAddress(message.from),
      To: Message.formatAddresses(message.to),
      Subject: message.subject,
    }

    if (message.cc.length > 0) {
      body.Cc = Message.formatAddresses(message.cc)
    }

    if (message.bcc.length > 0) {
      body.Bcc = Message.formatAddresses(message.bcc)
    }

    if (message.replyTo.length > 0) {
      body.ReplyTo = Message.formatAddresses(message.replyTo)
    }

    if (message.html !== null) {
      body.HtmlBody = message.html
    }

    if (message.text !== null) {
      body.TextBody = message.text
    }

    if (message.attachments.length > 0) {
      body.Attachments = message.attachments.map((attachment) => ({
        Name: attachment.filename,
        Content: typeof attachment.content === 'string'
          ? Buffer.from(attachment.content).toString('base64')
          : Buffer.from(attachment.content).toString('base64'),
        ContentType: attachment.contentType || 'application/octet-stream',
      }))
    }

    // Custom headers
    if (Object.keys(message.headers).length > 0) {
      body.Headers = Object.entries(message.headers).map(([Name, Value]) => ({
        Name,
        Value,
      }))
    }

    const response = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'X-Postmark-Server-Token': this.config.serverToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new MailError(`Postmark API error: ${response.status} ${response.statusText}`, {
        status: response.status,
        body: errorBody,
      })
    }

    const result = await response.json() as { MessageID: string; ErrorCode: number; Message: string }

    if (result.ErrorCode !== 0) {
      throw new MailError(`Postmark error: ${result.Message}`, {
        errorCode: result.ErrorCode,
      })
    }

    return { id: result.MessageID }
  }
}
