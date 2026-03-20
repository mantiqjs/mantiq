export interface MailAddress {
  address: string
  name?: string
}

export type MailerConfig =
  | { driver: 'smtp'; host: string; port: number; username?: string; password?: string; encryption?: 'tls' | 'starttls' | 'none' }
  | { driver: 'resend'; apiKey: string }
  | { driver: 'sendgrid'; apiKey: string }
  | { driver: 'mailgun'; apiKey: string; domain: string; region?: 'us' | 'eu' }
  | { driver: 'postmark'; serverToken: string }
  | { driver: 'ses'; region: string; accessKeyId: string; secretAccessKey: string }
  | { driver: 'log' }
  | { driver: 'array' }

export interface MailConfig {
  default: string
  from: MailAddress
  mailers: Record<string, MailerConfig>
}

export const DEFAULT_CONFIG: MailConfig = {
  default: 'log',
  from: { address: 'hello@example.com', name: 'MantiqJS' },
  mailers: {
    log: { driver: 'log' },
  },
}
