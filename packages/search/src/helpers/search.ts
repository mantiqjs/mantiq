import type { SearchEngine } from '../contracts/SearchEngine.ts'
import type { SearchManager } from '../SearchManager.ts'

export const SEARCH_MANAGER = Symbol('SearchManager')

let _manager: SearchManager | null = null

export function setSearchManager(manager: SearchManager): void {
  _manager = manager
}

export function getSearchManager(): SearchManager {
  if (!_manager) {
    throw new Error('SearchManager has not been initialized. Register SearchServiceProvider first.')
  }
  return _manager
}

/** Get the SearchManager or a specific engine. */
export function search(): SearchManager
export function search(engine: string): SearchEngine
export function search(engine?: string): SearchManager | SearchEngine {
  const manager = getSearchManager()
  if (engine === undefined) return manager
  return manager.driver(engine)
}
