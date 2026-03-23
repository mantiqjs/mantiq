import { env } from '@mantiq/core'

export default {

  /*
  |--------------------------------------------------------------------------
  | Default Cache Store
  |--------------------------------------------------------------------------
  |
  | This option controls the default cache connection that gets used
  | while using this caching library. You may use any of the stores
  | defined in the "stores" object below.
  |
  | Supported: 'memory', 'file', 'redis', 'memcached', 'null'
  |
  */
  default: env('CACHE_STORE', 'memory'),

  /*
  |--------------------------------------------------------------------------
  | Cache Key Prefix
  |--------------------------------------------------------------------------
  |
  | When utilizing a RAM-based store such as Redis or Memcached, there
  | might be other applications using the same cache. To avoid collisions,
  | you may prefix every cache key.
  |
  */
  prefix: env('CACHE_PREFIX', 'mantiq_cache_'),

  /*
  |--------------------------------------------------------------------------
  | Cache Stores
  |--------------------------------------------------------------------------
  |
  | Here you may define all of the cache "stores" for your application
  | as well as their drivers. You may even define multiple stores for
  | the same driver to group types of items stored in your caches.
  |
  */
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
