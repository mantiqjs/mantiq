import { env } from '@mantiq/core'
export default {
  default: env('LOG_CHANNEL', 'stack'),
  channels: {
    stack: { driver: 'stack' as const, channels: ['console', 'daily'] },
    console: { driver: 'console' as const, level: 'debug' as const },
    daily: { driver: 'daily' as const, path: 'storage/logs/mantiq.log', level: 'debug' as const, days: 14 },
  },
}
