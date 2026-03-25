import { env } from '@mantiq/core'
export default {
  default: env('MAIL_MAILER', 'log'),
  from: { address: env('MAIL_FROM_ADDRESS', 'vault@example.com'), name: env('MAIL_FROM_NAME', 'File Vault') },
  mailers: {
    smtp: { driver: 'smtp' as const, host: env('MAIL_HOST', 'localhost'), port: Number(env('MAIL_PORT', '587')), username: env('MAIL_USERNAME', ''), password: env('MAIL_PASSWORD', ''), encryption: env('MAIL_ENCRYPTION', 'starttls') as 'tls' | 'starttls' | 'none' },
    log: { driver: 'log' as const },
    array: { driver: 'array' as const },
  },
}
