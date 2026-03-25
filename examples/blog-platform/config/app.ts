import { env } from '@mantiq/core'
export default {
  name: env('APP_NAME', 'Blog Platform'),
  env: env('APP_ENV', 'development'),
  debug: env('APP_DEBUG', true),
  key: env('APP_KEY', ''),
  url: env('APP_URL', 'http://localhost:3001'),
  port: Number(env('APP_PORT', '3001')),
  basePath: import.meta.dir + '/..',
}
