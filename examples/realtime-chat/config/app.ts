import { env } from '@mantiq/core'
export default {
  name: env('APP_NAME', 'Real-Time Chat'),
  env: env('APP_ENV', 'development'),
  debug: env('APP_DEBUG', true),
  key: env('APP_KEY', ''),
  url: env('APP_URL', 'http://localhost:3004'),
  port: Number(env('APP_PORT', '3004')),
  basePath: import.meta.dir + '/..',
}
