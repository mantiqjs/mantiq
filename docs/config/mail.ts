import { env } from '@mantiq/core'

export default {
  default: env('MAIL_MAILER', 'log'),
  from: {
    address: env('MAIL_FROM_ADDRESS', 'hello@example.com'),
    name: env('MAIL_FROM_NAME', 'MantiqJS Docs'),
  },
  mailers: {
    log: { driver: 'log' as const },
  },
}
