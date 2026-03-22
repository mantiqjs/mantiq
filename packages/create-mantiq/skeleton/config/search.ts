export default {
  default: 'collection',
  prefix: '',
  queue: false,
  softDelete: false,

  engines: {
    collection: {
      driver: 'collection' as const,
    },
    database: {
      driver: 'database' as const,
    },
    // algolia: {
    //   driver: 'algolia' as const,
    //   applicationId: env('ALGOLIA_APP_ID', ''),
    //   apiKey: env('ALGOLIA_SECRET', ''),
    // },
    // meilisearch: {
    //   driver: 'meilisearch' as const,
    //   host: env('MEILISEARCH_HOST', 'http://127.0.0.1:7700'),
    //   apiKey: env('MEILISEARCH_KEY', ''),
    // },
  },
}
