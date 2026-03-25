import { env } from '@mantiq/core'
export default {
  name: env('APP_NAME', 'File Vault'),
  env: env('APP_ENV', 'development'),
  debug: env('APP_DEBUG', true),
  key: env('APP_KEY', ''),
  url: env('APP_URL', 'http://localhost:3005'),
  port: Number(env('APP_PORT', '3005')),
  basePath: import.meta.dir + '/..',
}
