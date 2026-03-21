import { env } from '@mantiq/core'

export default {
  default: env('MAIL_MAILER', 'log'),

  from: {
    address: env('MAIL_FROM_ADDRESS', 'hello@example.com'),
    name: env('MAIL_FROM_NAME', '/tmp/svelte-starter'),
  },

  mailers: {
    smtp: {
      driver: 'smtp' as const,
      host: env('MAIL_HOST', 'localhost'),
      port: Number(env('MAIL_PORT', '587')),
      username: env('MAIL_USERNAME', ''),
      password: env('MAIL_PASSWORD', ''),
      encryption: env('MAIL_ENCRYPTION', 'starttls') as 'tls' | 'starttls' | 'none',
    },

    resend: {
      driver: 'resend' as const,
      apiKey: env('RESEND_API_KEY', ''),
    },

    sendgrid: {
      driver: 'sendgrid' as const,
      apiKey: env('SENDGRID_API_KEY', ''),
    },

    mailgun: {
      driver: 'mailgun' as const,
      apiKey: env('MAILGUN_API_KEY', ''),
      domain: env('MAILGUN_DOMAIN', ''),
    },

    postmark: {
      driver: 'postmark' as const,
      serverToken: env('POSTMARK_TOKEN', ''),
    },

    ses: {
      driver: 'ses' as const,
      region: env('AWS_REGION', 'us-east-1'),
      accessKeyId: env('AWS_ACCESS_KEY_ID', ''),
      secretAccessKey: env('AWS_SECRET_ACCESS_KEY', ''),
    },

    log: { driver: 'log' as const },
    array: { driver: 'array' as const },
  },
}
