import { env } from '@mantiq/core'

export default {
  default: env('LOG_CHANNEL', 'console'),
  channels: {
    console: { driver: 'console' as const, level: 'debug' },
  },
}
