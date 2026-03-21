import { SearchManager } from './SearchManager.ts'
import { setSearchManager, SEARCH_MANAGER } from './helpers/search.ts'
import type { SearchConfig } from './contracts/SearchConfig.ts'
import { DEFAULT_CONFIG } from './contracts/SearchConfig.ts'
import type { SearchEngine } from './contracts/SearchEngine.ts'

export class SearchServiceProvider {
  constructor(private readonly app: any) {}

  register(): void {
    this.app.singleton(SearchManager, () => {
      const configRepo = this.app.make?.('ConfigRepository') ?? this.app.config?.()
      const config: SearchConfig = configRepo?.get?.('search') ?? DEFAULT_CONFIG

      const builtInEngines = new Map<string, (cfg: any) => SearchEngine>()

      builtInEngines.set('collection', () => {
        const { CollectionEngine } = require('./drivers/CollectionEngine.ts')
        return new CollectionEngine()
      })

      builtInEngines.set('database', (cfg) => {
        const { DatabaseEngine } = require('./drivers/DatabaseEngine.ts')
        return new DatabaseEngine(cfg.connection)
      })

      builtInEngines.set('algolia', (cfg) => {
        const { AlgoliaEngine } = require('./drivers/AlgoliaEngine.ts')
        return new AlgoliaEngine(cfg.applicationId, cfg.apiKey, cfg.indexSettings)
      })

      builtInEngines.set('meilisearch', (cfg) => {
        const { MeilisearchEngine } = require('./drivers/MeilisearchEngine.ts')
        return new MeilisearchEngine(cfg.host, cfg.apiKey)
      })

      builtInEngines.set('typesense', (cfg) => {
        const { TypesenseEngine } = require('./drivers/TypesenseEngine.ts')
        return new TypesenseEngine(cfg.host, cfg.port, cfg.protocol, cfg.apiKey)
      })

      builtInEngines.set('elasticsearch', (cfg) => {
        const { ElasticsearchEngine } = require('./drivers/ElasticsearchEngine.ts')
        return new ElasticsearchEngine(cfg.hosts, cfg.apiKey, cfg.username, cfg.password)
      })

      const manager = new SearchManager(config, builtInEngines)
      setSearchManager(manager)
      return manager
    })

    this.app.alias?.(SearchManager, SEARCH_MANAGER)
  }

  boot(): void {
    // Service provider boot — nothing needed here.
    // Models opt in to search via makeSearchable() in their booted().
  }
}
