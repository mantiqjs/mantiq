// ── Contracts ────────────────────────────────────────────────────────────────
export type { NotificationChannel } from './contracts/Channel.ts'
export type { Notifiable } from './contracts/Notifiable.ts'
export type { NotifyConfig, SmsConfig, SlackConfig, TelegramConfig, WhatsAppConfig, IMessageConfig, RcsConfig, FirebaseConfig } from './contracts/NotifyConfig.ts'

// ── Core ─────────────────────────────────────────────────────────────────────
export { Notification } from './Notification.ts'
export type { SlackMessage, BroadcastPayload, SmsPayload, WebhookPayload } from './Notification.ts'
export { NotificationManager } from './NotificationManager.ts'
export type { DeliveryLogEntry } from './NotificationManager.ts'

// ── Channels ─────────────────────────────────────────────────────────────────
export { MailChannel } from './channels/MailChannel.ts'
export { DatabaseChannel } from './channels/DatabaseChannel.ts'
export { BroadcastChannel } from './channels/BroadcastChannel.ts'
export { SmsChannel } from './channels/SmsChannel.ts'
export { SlackChannel } from './channels/SlackChannel.ts'
export { WebhookChannel } from './channels/WebhookChannel.ts'
export { DiscordChannel } from './channels/DiscordChannel.ts'
export { TelegramChannel } from './channels/TelegramChannel.ts'
export { WhatsAppChannel } from './channels/WhatsAppChannel.ts'
export { IMessageChannel } from './channels/IMessageChannel.ts'
export { RcsChannel } from './channels/RcsChannel.ts'
export { FirebaseChannel } from './channels/FirebaseChannel.ts'

// ── Models ───────────────────────────────────────────────────────────────────
export { DatabaseNotification } from './models/DatabaseNotification.ts'

// ── Events ───────────────────────────────────────────────────────────────────
export { NotificationSending, NotificationSent, NotificationFailed } from './events/NotificationEvents.ts'

// ── Helpers ──────────────────────────────────────────────────────────────────
export { notify, NOTIFY_MANAGER } from './helpers/notify.ts'

// ── Service Provider ─────────────────────────────────────────────────────────
export { NotificationServiceProvider } from './NotificationServiceProvider.ts'

// ── Testing ──────────────────────────────────────────────────────────────────
export { NotificationFake } from './testing/NotificationFake.ts'

// ── Errors ───────────────────────────────────────────────────────────────────
export { NotifyError } from './errors/NotifyError.ts'

// ── Commands ─────────────────────────────────────────────────────────────────
export { MakeNotificationCommand } from './commands/MakeNotificationCommand.ts'
