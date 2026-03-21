// @mantiq/search — public API exports

// Contracts
export type { SearchEngine, SearchResult } from './contracts/SearchEngine.ts'
export type { SearchConfig, EngineConfig } from './contracts/SearchConfig.ts'
export { DEFAULT_CONFIG } from './contracts/SearchConfig.ts'

// Core
export { SearchManager } from './SearchManager.ts'
export { SearchBuilder, type PaginatedSearchResult, type WhereClause, type WhereInClause, type OrderClause } from './SearchBuilder.ts'
export { SearchServiceProvider } from './SearchServiceProvider.ts'
export { makeSearchable } from './Searchable.ts'
export { SearchObserver } from './SearchObserver.ts'

// Drivers
export { CollectionEngine } from './drivers/CollectionEngine.ts'
export { DatabaseEngine } from './drivers/DatabaseEngine.ts'
export { AlgoliaEngine } from './drivers/AlgoliaEngine.ts'
export { MeilisearchEngine } from './drivers/MeilisearchEngine.ts'
export { TypesenseEngine } from './drivers/TypesenseEngine.ts'
export { ElasticsearchEngine } from './drivers/ElasticsearchEngine.ts'

// Commands
export { SearchImportCommand } from './commands/SearchImportCommand.ts'
export { SearchFlushCommand } from './commands/SearchFlushCommand.ts'
export { SearchIndexCommand } from './commands/SearchIndexCommand.ts'
export { SearchDeleteIndexCommand } from './commands/SearchDeleteIndexCommand.ts'

// Jobs
export { MakeSearchableJob } from './jobs/MakeSearchableJob.ts'

// Helpers
export { search, SEARCH_MANAGER, setSearchManager, getSearchManager } from './helpers/search.ts'

// Testing
export { SearchFake } from './testing/SearchFake.ts'

// Errors
export { SearchError } from './errors/SearchError.ts'
