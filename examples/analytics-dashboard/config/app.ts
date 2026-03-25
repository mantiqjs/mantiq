import { env } from '@mantiq/core'
export default {
  name: env('APP_NAME', 'Analytics Dashboard'),
  env: env('APP_ENV', 'development'),
  debug: env('APP_DEBUG', true),
  key: env('APP_KEY', ''),
  url: env('APP_URL', 'http://localhost:3006'),
  port: Number(env('APP_PORT', '3006')),
  basePath: import.meta.dir + '/..',
}
