import { env } from '@mantiq/core'

/**
 * Filesystem Configuration
 *
 * Configure your filesystem disks here. Each disk represents a storage
 * location with a specific driver.
 *
 * Supported drivers: 'local', 's3', 'gcs', 'r2', 'azure', 'ftp', 'sftp'
 */
export default {
  // Default disk used by storage() helper and filesystem operations
  default: env('FILESYSTEM_DISK', 'local'),

  disks: {
    // Private storage — not web-accessible, for uploads, temp files, etc.
    local: {
      driver: 'local' as const,
      root: import.meta.dir + '/../storage/app',
    },

    // Public storage — web-accessible via /storage URL
    // Run `bun mantiq storage:link` to create the public symlink
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
  },
}
