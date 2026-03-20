// ── Contracts ────────────────────────────────────────────────────────────────
export type { MailTransport } from './contracts/Transport.ts'
export type { MailConfig, MailerConfig, MailAddress } from './contracts/MailConfig.ts'
export { DEFAULT_CONFIG } from './contracts/MailConfig.ts'

// ── Core ─────────────────────────────────────────────────────────────────────
export { Message, type Attachment } from './Message.ts'
export { Mailable } from './Mailable.ts'
export { MailManager } from './MailManager.ts'
export { PendingMail } from './PendingMail.ts'

// ── Drivers ──────────────────────────────────────────────────────────────────
export { SmtpTransport } from './drivers/SmtpTransport.ts'
export { ResendTransport } from './drivers/ResendTransport.ts'
export { SendGridTransport } from './drivers/SendGridTransport.ts'
export { MailgunTransport } from './drivers/MailgunTransport.ts'
export { PostmarkTransport } from './drivers/PostmarkTransport.ts'
export { SesTransport } from './drivers/SesTransport.ts'
export { LogTransport } from './drivers/LogTransport.ts'
export { ArrayTransport } from './drivers/ArrayTransport.ts'

// ── Markdown ─────────────────────────────────────────────────────────────────
export { renderMarkdown } from './markdown/MarkdownRenderer.ts'
export { wrapInLayout, renderButton, renderPanel, renderTable } from './markdown/theme.ts'

// ── Helpers ──────────────────────────────────────────────────────────────────
export { mail, MAIL_MANAGER } from './helpers/mail.ts'

// ── Service Provider ─────────────────────────────────────────────────────────
export { MailServiceProvider } from './MailServiceProvider.ts'

// ── Testing ──────────────────────────────────────────────────────────────────
export { MailFake } from './testing/MailFake.ts'

// ── Errors ───────────────────────────────────────────────────────────────────
export { MailError } from './errors/MailError.ts'

// ── Commands ─────────────────────────────────────────────────────────────────
export { MakeMailCommand } from './commands/MakeMailCommand.ts'
