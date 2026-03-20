import { env } from '@mantiq/core'

export default {
  default: env('QUEUE_CONNECTION', 'sync'),
  connections: {
    sync: { driver: 'sync' as const },
  },
}
