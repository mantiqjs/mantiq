import type { MailAddress } from './contracts/MailConfig.ts'

export interface Attachment {
  filename: string
  content: Uint8Array | string
  contentType?: string | undefined
}

export class Message {
  from: MailAddress = { address: '' }
  to: MailAddress[] = []
  cc: MailAddress[] = []
  bcc: MailAddress[] = []
  replyTo: MailAddress[] = []
  subject = ''
  html: string | null = null
  text: string | null = null
  attachments: Attachment[] = []
  headers: Record<string, string> = {}

  setFrom(address: string | MailAddress): this {
    this.from = typeof address === 'string' ? { address } : address
    return this
  }

  addTo(address: string | MailAddress): this {
    this.to.push(typeof address === 'string' ? { address } : address)
    return this
  }

  addCc(address: string | MailAddress): this {
    this.cc.push(typeof address === 'string' ? { address } : address)
    return this
  }

  addBcc(address: string | MailAddress): this {
    this.bcc.push(typeof address === 'string' ? { address } : address)
    return this
  }

  addReplyTo(address: string | MailAddress): this {
    this.replyTo.push(typeof address === 'string' ? { address } : address)
    return this
  }

  setSubject(subject: string): this {
    this.subject = subject
    return this
  }

  setHtml(html: string): this {
    this.html = html
    return this
  }

  setText(text: string): this {
    this.text = text
    return this
  }

  addAttachment(filename: string, content: Uint8Array | string, contentType?: string): this {
    this.attachments.push({ filename, content, contentType })
    return this
  }

  setHeader(key: string, value: string): this {
    // Security: reject CRLF characters to prevent email header injection.
    // An attacker could inject \r\n to add arbitrary headers (e.g. BCC, CC)
    // which would allow sending copies of emails to unintended recipients.
    if (/[\r\n]/.test(key) || /[\r\n]/.test(value)) {
      throw new Error('Header key and value must not contain CR or LF characters')
    }
    this.headers[key] = value
    return this
  }

  /** Format address for SMTP/API: "Name <email>" or just "email" */
  static formatAddress(addr: MailAddress): string {
    return addr.name ? `${addr.name} <${addr.address}>` : addr.address
  }

  /** Format address list */
  static formatAddresses(addrs: MailAddress[]): string {
    return addrs.map(Message.formatAddress).join(', ')
  }
}
