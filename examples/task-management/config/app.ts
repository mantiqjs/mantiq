import { env } from '@mantiq/core'

export default {
  name: env('APP_NAME', 'Task Management'),
  env: env('APP_ENV', 'production'),
  debug: env('APP_DEBUG', false),
  key: env('APP_KEY', ''),
  url: env('APP_URL', 'http://localhost:3002'),
  port: Number(env('APP_PORT', '3002')),
  basePath: import.meta.dir + '/..',
}
