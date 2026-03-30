import { env } from '@mantiq/core'

export default {

  /*
  |--------------------------------------------------------------------------
  | Default Mailer
  |--------------------------------------------------------------------------
  |
  | This option controls the default mailer used to send emails. The "log"
  | mailer writes email content to your log file — safe for development.
  |
  | Supported: 'smtp', 'resend', 'sendgrid', 'mailgun', 'postmark',
  |            'ses', 'log', 'array'
  |
  */
  default: env('MAIL_MAILER', 'log'),

  /*
  |--------------------------------------------------------------------------
  | Global "From" Address
  |--------------------------------------------------------------------------
  |
  | The default sender address used when a mailable doesn't specify its own.
  | All emails sent by your application will use this address unless
  | explicitly overridden.
  |
  */
  from: {
    address: env('MAIL_FROM_ADDRESS', 'hello@example.com'),
    name: env('MAIL_FROM_NAME', 'MantiqJS'),
  },

  /*
  |--------------------------------------------------------------------------
  | Mailer Configurations
  |--------------------------------------------------------------------------
  |
  | Here you may configure all of the mailers used by your application.
  | Each mailer uses a specific transport driver and credentials.
  |
  */
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

    // SendGrid (https://sendgrid.com)
    sendgrid: {
      driver: 'sendgrid' as const,
      apiKey: env('SENDGRID_API_KEY', ''),
    },

    // Mailgun (https://mailgun.com)
    mailgun: {
      driver: 'mailgun' as const,
      apiKey: env('MAILGUN_API_KEY', ''),
      domain: env('MAILGUN_DOMAIN', ''),
    },

    // Postmark (https://postmarkapp.com)
    postmark: {
      driver: 'postmark' as const,
      serverToken: env('POSTMARK_TOKEN', ''),
    },

    // Amazon SES
    ses: {
      driver: 'ses' as const,
      region: env('AWS_REGION', 'us-east-1'),
      accessKeyId: env('AWS_ACCESS_KEY_ID', ''),
      secretAccessKey: env('AWS_SECRET_ACCESS_KEY', ''),
    },

    // Writes email content to log file (development)
    log: { driver: 'log' as const },

    // Stores emails in memory (unit testing)
    array: { driver: 'array' as const },
  },
}
