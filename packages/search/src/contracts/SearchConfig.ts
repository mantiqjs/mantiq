export type EngineConfig =
  | { driver: 'collection' }
  | { driver: 'database'; connection?: string }
  | { driver: 'algolia'; applicationId: string; apiKey: string; indexSettings?: Record<string, any> }
  | { driver: 'meilisearch'; host: string; apiKey: string }
  | { driver: 'typesense'; host: string; port: number; protocol: 'http' | 'https'; apiKey: string }
  | { driver: 'elasticsearch'; hosts: string[]; apiKey?: string; username?: string; password?: string }

export interface SearchConfig {
  /** Default engine name */
  default: string
  /** Index name prefix (e.g., 'prod_') */
  prefix: string
  /** false = sync, true = default queue, string = named queue */
  queue: boolean | string
  /** Include __soft_deleted field in indexed data */
  softDelete: boolean
  /** Engine configurations keyed by name */
  engines: Record<string, EngineConfig>
}

export const DEFAULT_CONFIG: SearchConfig = {
  default: 'collection',
  prefix: '',
  queue: false,
  softDelete: false,
  engines: {
    collection: { driver: 'collection' },
  },
}
