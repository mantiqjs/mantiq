import { env } from '@mantiq/core'

export default {
  default: env('FILESYSTEM_DISK', 'local'),

  disks: {
    local: {
      driver: 'local' as const,
      root: 'storage/app',
      url: env('APP_URL', 'http://localhost:3000') + '/storage',
    },
    public: {
      driver: 'local' as const,
      root: 'storage/app/public',
      url: env('APP_URL', 'http://localhost:3000') + '/storage',
      visibility: 'public' as const,
    },
  },
}
