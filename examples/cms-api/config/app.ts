import { env } from '@mantiq/core'

export default {
  name: env('APP_NAME', 'Headless CMS'),
  env: env('APP_ENV', 'production'),
  debug: env('APP_DEBUG', false),
  key: env('APP_KEY', ''),
  url: env('APP_URL', 'http://localhost:3010'),
  port: Number(env('APP_PORT', '3010')),
  basePath: import.meta.dir + '/..',
}
