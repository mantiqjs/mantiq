import type { MailTransport } from '../contracts/Transport.ts'
import { Message } from '../Message.ts'

export class LogTransport implements MailTransport {
  async send(message: Message): Promise<{ id: string }> {
    const id = crypto.randomUUID()

    const to = Message.formatAddresses(message.to)
    const subject = message.subject
    const preview = message.text
      ? message.text.substring(0, 200)
      : message.html
        ? message.html.replace(/<[^>]*>/g, '').substring(0, 200)
        : '(no body)'

    console.log(
      `[Mail] To: ${to} | Subject: ${subject} | Preview: ${preview}`,
    )

    return { id }
  }
}
