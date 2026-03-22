import { env } from '@mantiq/core'

/**
 * Mail Configuration
 *
 * Configure outgoing email transports. Each mailer defines a delivery
 * driver and its credentials. Switch mailers via MAIL_MAILER in .env.
 *
 * Supported drivers: 'smtp', 'resend', 'sendgrid', 'mailgun', 'postmark', 'ses', 'log', 'array'
 */
export default {
  // Default mailer — 'log' writes emails to the log file (safe for development)
  default: env('MAIL_MAILER', 'log'),

  // Global "from" address — used when a mailable doesn't specify its own
  from: {
    address: env('MAIL_FROM_ADDRESS', 'hello@example.com'),
    name: env('MAIL_FROM_NAME', 'MantiqJS'),
  },

  mailers: {
    // Standard SMTP — works with any SMTP server (Mailtrap, Gmail, etc.)
    smtp: {
      driver: 'smtp' as const,
      host: env('MAIL_HOST', 'localhost'),
      port: Number(env('MAIL_PORT', '587')),
      username: env('MAIL_USERNAME', ''),
      password: env('MAIL_PASSWORD', ''),
      encryption: env('MAIL_ENCRYPTION', 'starttls') as 'tls' | 'starttls' | 'none',
    },

    // Resend — modern email API (https://resend.com)
    resend: {
      driver: 'resend' as const,
      apiKey: env('RESEND_API_KEY', ''),
    },

    // SendGrid — transactional email (https://sendgrid.com)
    sendgrid: {
      driver: 'sendgrid' as const,
      apiKey: env('SENDGRID_API_KEY', ''),
    },

    // Mailgun — email API (https://mailgun.com)
    mailgun: {
      driver: 'mailgun' as const,
      apiKey: env('MAILGUN_API_KEY', ''),
      domain: env('MAILGUN_DOMAIN', ''),
    },

    // Postmark — transactional email (https://postmarkapp.com)
    postmark: {
      driver: 'postmark' as const,
      serverToken: env('POSTMARK_TOKEN', ''),
    },

    // Amazon SES — AWS email service
    ses: {
      driver: 'ses' as const,
      region: env('AWS_REGION', 'us-east-1'),
      accessKeyId: env('AWS_ACCESS_KEY_ID', ''),
      secretAccessKey: env('AWS_SECRET_ACCESS_KEY', ''),
    },

    // Log — writes email content to log file (for development/testing)
    log: { driver: 'log' as const },

    // Array — stores emails in memory (for unit testing)
    array: { driver: 'array' as const },
  },
}
