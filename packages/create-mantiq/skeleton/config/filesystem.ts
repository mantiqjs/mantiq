import { env } from '@mantiq/core'

export default {

  /*
  |--------------------------------------------------------------------------
  | Default Filesystem Disk
  |--------------------------------------------------------------------------
  |
  | The default filesystem disk used by the storage() helper and all
  | file operations. You may use any of the disks defined below.
  |
  */
  default: env('FILESYSTEM_DISK', 'local'),

  /*
  |--------------------------------------------------------------------------
  | Filesystem Disks
  |--------------------------------------------------------------------------
  |
  | Here you may configure as many filesystem "disks" as you wish. Each
  | disk represents a particular storage driver and location.
  |
  | Supported drivers: 'local', 's3', 'gcs', 'r2', 'azure', 'ftp', 'sftp'
  |
  */
  disks: {
    // Private storage — not web-accessible (uploads, temp files, exports)
    local: {
      driver: 'local' as const,
      root: import.meta.dir + '/../storage/app',
    },

    // Public storage — web-accessible via /storage URL
    // Run: bun mantiq storage:link
    public: {
      driver: 'local' as const,
      root: import.meta.dir + '/../storage/app/public',
      visibility: 'public' as const,
    },

    // s3: {
    //   driver: 's3' as const,
    //   bucket: env('AWS_BUCKET', ''),
    //   region: env('AWS_REGION', 'us-east-1'),
    //   accessKeyId: env('AWS_ACCESS_KEY_ID', ''),
    //   secretAccessKey: env('AWS_SECRET_ACCESS_KEY', ''),
    // },

    // r2: {
    //   driver: 'r2' as const,
    //   accountId: env('CLOUDFLARE_ACCOUNT_ID', ''),
    //   bucket: env('R2_BUCKET', ''),
    //   accessKeyId: env('R2_ACCESS_KEY_ID', ''),
    //   secretAccessKey: env('R2_SECRET_ACCESS_KEY', ''),
    // },
  },
}
