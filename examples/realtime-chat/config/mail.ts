import { env } from '@mantiq/core'
export default {
  default: env('MAIL_MAILER', 'log'),
  from: { address: env('MAIL_FROM_ADDRESS', 'chat@example.com'), name: env('MAIL_FROM_NAME', 'Real-Time Chat') },
  mailers: {
    log: { driver: 'log' as const },
    array: { driver: 'array' as const },
  },
}
