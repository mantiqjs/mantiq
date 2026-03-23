// import { env } from '@mantiq/core'

export default {

  /*
  |--------------------------------------------------------------------------
  | Default Search Engine
  |--------------------------------------------------------------------------
  |
  | The default search engine used when performing full-text searches on
  | models with the Searchable trait. The "collection" engine works
  | in-memory with no external dependencies — ideal for development.
  |
  | Supported: 'collection', 'database', 'algolia', 'meilisearch',
  |            'typesense', 'elasticsearch'
  |
  */
  default: 'collection',

  /*
  |--------------------------------------------------------------------------
  | Index Prefix
  |--------------------------------------------------------------------------
  |
  | This prefix is added to all search index names. Useful to avoid
  | collisions when multiple applications share the same search service.
  |
  */
  prefix: '',

  /*
  |--------------------------------------------------------------------------
  | Queue Indexing
  |--------------------------------------------------------------------------
  |
  | When true, model index updates are dispatched to the queue for
  | background processing, keeping your request cycle fast.
  |
  */
  queue: false,

  /*
  |--------------------------------------------------------------------------
  | Soft Delete Behavior
  |--------------------------------------------------------------------------
  |
  | When true, soft-deleted models remain in the search index and can
  | be included in search results.
  |
  */
  softDelete: false,

  /*
  |--------------------------------------------------------------------------
  | Search Engines
  |--------------------------------------------------------------------------
  |
  | Configure the search engine backends available to your application.
  | Uncomment and configure the engines you need.
  |
  */
  engines: {
    // In-memory — no external service needed (development)
    collection: {
      driver: 'collection' as const,
    },

    // SQL LIKE queries — uses your existing database
    database: {
      driver: 'database' as const,
    },

    // Algolia — hosted search API (https://algolia.com)
    // algolia: {
    //   driver: 'algolia' as const,
    //   applicationId: env('ALGOLIA_APP_ID', ''),
    //   apiKey: env('ALGOLIA_SECRET', ''),
    // },

    // Meilisearch — open-source (https://meilisearch.com)
    // meilisearch: {
    //   driver: 'meilisearch' as const,
    //   host: env('MEILISEARCH_HOST', 'http://127.0.0.1:7700'),
    //   apiKey: env('MEILISEARCH_KEY', ''),
    // },

    // Typesense — open-source (https://typesense.org)
    // typesense: {
    //   driver: 'typesense' as const,
    //   host: env('TYPESENSE_HOST', 'localhost'),
    //   port: Number(env('TYPESENSE_PORT', '8108')),
    //   apiKey: env('TYPESENSE_API_KEY', ''),
    //   protocol: 'http',
    // },
  },
}
