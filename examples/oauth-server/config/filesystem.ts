import { env } from '@mantiq/core'
export default {
  default: env('FILESYSTEM_DISK', 'local'),
  disks: {
    local: { driver: 'local' as const, root: import.meta.dir + '/../storage/app' },
    public: { driver: 'local' as const, root: import.meta.dir + '/../storage/app/public', visibility: 'public' as const },
  },
}
