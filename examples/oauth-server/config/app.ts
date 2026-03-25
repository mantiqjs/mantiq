import { env } from '@mantiq/core'
export default {
  name: env('APP_NAME', 'OAuth Server'),
  env: env('APP_ENV', 'development'),
  debug: env('APP_DEBUG', true),
  key: env('APP_KEY', ''),
  url: env('APP_URL', 'http://localhost:3008'),
  port: Number(env('APP_PORT', '3008')),
  basePath: import.meta.dir + '/..',
}
