import { env } from '@mantiq/core'

export default {
  name: env('APP_NAME', 'E-Commerce API'),
  env: env('APP_ENV', 'production'),
  debug: env('APP_DEBUG', false),
  key: env('APP_KEY', ''),
  url: env('APP_URL', 'http://localhost:3003'),
  port: Number(env('APP_PORT', '3003')),
  basePath: import.meta.dir + '/..',
}
