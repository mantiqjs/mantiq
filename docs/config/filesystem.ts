import { env } from '@mantiq/core'

export default {
  default: env('FILESYSTEM_DISK', 'local'),
  disks: {
    local: { driver: 'local' as const, root: 'storage/app' },
  },
}
