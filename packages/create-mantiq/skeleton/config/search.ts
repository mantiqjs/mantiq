// import { env } from '@mantiq/core'

/**
 * Full-Text Search Configuration
 *
 * Define search engines for your application. Models using the Searchable
 * trait are automatically indexed and searchable.
 *
 * Supported drivers: 'collection' (in-memory), 'database' (SQL LIKE),
 *   'algolia', 'meilisearch', 'typesense', 'elasticsearch'
 */
export default {
  // Default search engine
  default: 'collection',

  // Index prefix — useful to avoid collisions in shared search services
  prefix: '',

  // Queue indexing operations for better performance
  queue: false,

  // Include soft-deleted models in search results
  softDelete: false,

  engines: {
    // In-memory collection search — no external service needed (good for development)
    collection: {
      driver: 'collection' as const,
    },

    // SQL-based search using LIKE queries
    database: {
      driver: 'database' as const,
    },

    // Algolia — hosted search API (https://algolia.com)
    // algolia: {
    //   driver: 'algolia' as const,
    //   applicationId: env('ALGOLIA_APP_ID', ''),
    //   apiKey: env('ALGOLIA_SECRET', ''),
    // },

    // Meilisearch — open-source search engine (https://meilisearch.com)
    // meilisearch: {
    //   driver: 'meilisearch' as const,
    //   host: env('MEILISEARCH_HOST', 'http://127.0.0.1:7700'),
    //   apiKey: env('MEILISEARCH_KEY', ''),
    // },

    // Typesense — open-source search engine (https://typesense.org)
    // typesense: {
    //   driver: 'typesense' as const,
    //   host: env('TYPESENSE_HOST', 'localhost'),
    //   port: Number(env('TYPESENSE_PORT', '8108')),
    //   apiKey: env('TYPESENSE_API_KEY', ''),
    //   protocol: 'http',
    // },
  },
}
