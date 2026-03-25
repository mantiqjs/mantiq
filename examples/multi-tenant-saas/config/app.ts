import { env } from '@mantiq/core'

export default {
  name: env('APP_NAME', 'Multi-Tenant SaaS'),
  env: env('APP_ENV', 'production'),
  debug: env('APP_DEBUG', false),
  key: env('APP_KEY', ''),
  url: env('APP_URL', 'http://localhost:3007'),
  port: Number(env('APP_PORT', '3007')),
  basePath: import.meta.dir + '/..',
}
