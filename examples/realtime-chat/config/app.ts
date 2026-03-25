import { env } from '@mantiq/core'

export default {
  name: env('APP_NAME', 'Mantiq Chat'),
  env: env('APP_ENV', 'production'),
  debug: env('APP_DEBUG', false),
  key: env('APP_KEY', ''),
  url: env('APP_URL', 'http://localhost:3004'),
  port: Number(env('APP_PORT', '3004')),
  basePath: import.meta.dir + '/..',
}
