import type { MailTransport } from '../contracts/Transport.ts'
import type { Message } from '../Message.ts'

export class ArrayTransport implements MailTransport {
  sent: Message[] = []

  async send(message: Message): Promise<{ id: string }> {
    const id = crypto.randomUUID()
    this.sent.push(message)
    return { id }
  }

  /** Clear all stored messages */
  flush(): void {
    this.sent = []
  }
}
