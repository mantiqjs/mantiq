import type { MailAddress } from './contracts/MailConfig.ts'
import { Message, type Attachment } from './Message.ts'
import { renderMarkdown } from './markdown/MarkdownRenderer.ts'

/**
 * Base class for all mailables. Users extend this and implement build().
 *
 * @example
 *   class WelcomeEmail extends Mailable {
 *     constructor(private user: { name: string }) { super() }
 *
 *     build() {
 *       this.setSubject('Welcome!')
 *       this.markdown(`# Hi ${this.user.name}!\n\nWelcome aboard.`)
 *     }
 *   }
 */
export abstract class Mailable {
  private _to: MailAddress[] = []
  private _cc: MailAddress[] = []
  private _bcc: MailAddress[] = []
  private _replyTo: MailAddress[] = []
  private _subject = ''
  private _html: string | null = null
  private _text: string | null = null
  private _markdown: string | null = null
  private _attachments: Attachment[] = []
  private _headers: Record<string, string> = {}
  private _appName = 'MantiqJS'

  abstract build(): void

  // ── Recipients (can be set before send) ──────────────────────────────────

  to(address: string | MailAddress | (string | MailAddress)[]): this {
    const addrs = Array.isArray(address) ? address : [address]
    this._to.push(...addrs.map(a => typeof a === 'string' ? { address: a } : a))
    return this
  }

  cc(address: string | MailAddress | (string | MailAddress)[]): this {
    const addrs = Array.isArray(address) ? address : [address]
    this._cc.push(...addrs.map(a => typeof a === 'string' ? { address: a } : a))
    return this
  }

  bcc(address: string | MailAddress | (string | MailAddress)[]): this {
    const addrs = Array.isArray(address) ? address : [address]
    this._bcc.push(...addrs.map(a => typeof a === 'string' ? { address: a } : a))
    return this
  }

  replyTo(address: string | MailAddress): this {
    this._replyTo.push(typeof address === 'string' ? { address } : address)
    return this
  }

  // ── Content ───────────────────────────────────────────────────────────────

  protected setSubject(subject: string): this {
    this._subject = subject
    return this
  }

  protected html(content: string): this {
    this._html = content
    this._markdown = null
    return this
  }

  protected text(content: string): this {
    this._text = content
    return this
  }

  protected markdown(content: string): this {
    this._markdown = content
    this._html = null
    return this
  }

  protected attach(filename: string, content: Uint8Array | string, contentType?: string): this {
    this._attachments.push({ filename, content, contentType })
    return this
  }

  protected header(key: string, value: string): this {
    this._headers[key] = value
    return this
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  /** Set the app name for email template header. Called by MailManager. */
  setAppName(name: string): void {
    this._appName = name
  }

  /** Convert to a Message ready for transport. Call build() first. */
  toMessage(from: MailAddress): Message {
    this.build()

    const msg = new Message()
    msg.setFrom(from)
    msg.subject = this._subject

    for (const addr of this._to) msg.addTo(addr)
    for (const addr of this._cc) msg.addCc(addr)
    for (const addr of this._bcc) msg.addBcc(addr)
    for (const addr of this._replyTo) msg.addReplyTo(addr)

    if (this._markdown) {
      msg.html = renderMarkdown(this._markdown, { appName: this._appName })
      // Generate plain text by stripping tags
      msg.text = this._text ?? stripHtml(this._markdown)
    } else if (this._html) {
      msg.html = this._html
      msg.text = this._text
    } else if (this._text) {
      msg.text = this._text
    }

    msg.attachments = [...this._attachments]
    msg.headers = { ...this._headers }

    return msg
  }

  /** Get recipients set on this mailable */
  getTo(): MailAddress[] { return this._to }
  getCc(): MailAddress[] { return this._cc }
  getBcc(): MailAddress[] { return this._bcc }
  getSubject(): string { return this._subject }
}

function stripHtml(md: string): string {
  // Remove markdown syntax to produce plain text
  return md
    .replace(/\[button[^\]]*\](.*?)\[\/button\]/g, '$1')
    .replace(/\[panel\]([\s\S]*?)\[\/panel\]/g, '$1')
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/>\s*/gm, '')
    .trim()
}
