import { env } from '@mantiq/core'

export default {
  // Default cache store: 'memory' | 'file' | 'redis' | 'memcached' | 'null'
  default: env('CACHE_STORE', 'memory'),

  // Optional key prefix to avoid collisions in shared stores
  prefix: env('CACHE_PREFIX', 'mantiq_cache_'),

  stores: {
    memory: {},

    file: {
      path: 'storage/cache',
    },

    redis: {
      url: env('REDIS_URL', ''),
      host: env('REDIS_HOST', '127.0.0.1'),
      port: Number(env('REDIS_PORT', '6379')),
      password: env('REDIS_PASSWORD', ''),
      db: Number(env('REDIS_CACHE_DB', '1')),
    },

    memcached: {
      host: env('MEMCACHED_HOST', '127.0.0.1'),
      port: Number(env('MEMCACHED_PORT', '11211')),
    },
  },
}
