import type { Message } from '../Message.ts'

export interface MailTransport {
  send(message: Message): Promise<{ id: string }>
}
