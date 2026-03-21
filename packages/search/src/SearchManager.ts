import type { SearchEngine } from './contracts/SearchEngine.ts'
import type { SearchConfig, EngineConfig } from './contracts/SearchConfig.ts'
import { SearchError } from './errors/SearchError.ts'

type EngineFactory = (config: EngineConfig) => SearchEngine

export class SearchManager {
  private readonly engines = new Map<string, SearchEngine>()
  private readonly customEngines = new Map<string, EngineFactory>()

  constructor(
    private readonly config: SearchConfig,
    private readonly builtInEngines: Map<string, EngineFactory> = new Map(),
  ) {}

  /** Get an engine instance by name, lazy-loaded and cached. */
  driver(name?: string): SearchEngine {
    const engineName = name ?? this.config.default
    if (this.engines.has(engineName)) return this.engines.get(engineName)!

    const engineConfig = this.config.engines[engineName]
    if (!engineConfig) {
      throw new SearchError(`Search engine "${engineName}" is not configured`, { engine: engineName })
    }

    const engine = this.createEngine(engineConfig)
    this.engines.set(engineName, engine)
    return engine
  }

  /** Register a custom engine driver. */
  extend(name: string, factory: EngineFactory): void {
    this.customEngines.set(name, factory)
  }

  /** Get the default driver name. */
  getDefaultDriver(): string {
    return this.config.default
  }

  /** Get the search config. */
  getConfig(): SearchConfig {
    return this.config
  }

  /** Get the index prefix. */
  getPrefix(): string {
    return this.config.prefix
  }

  /** Forget a cached engine instance. */
  forget(name: string): void {
    this.engines.delete(name)
  }

  // ── Delegation to default engine ──────────────────────────────────

  async update(models: any[]): Promise<void> {
    return this.driver().update(models)
  }

  async delete(models: any[]): Promise<void> {
    return this.driver().delete(models)
  }

  async flush(indexName: string): Promise<void> {
    return this.driver().flush(indexName)
  }

  async createIndex(name: string, options?: Record<string, any>): Promise<void> {
    return this.driver().createIndex(name, options)
  }

  async deleteIndex(name: string): Promise<void> {
    return this.driver().deleteIndex(name)
  }

  // ── Private ───────────────────────────────────────────────────────

  private createEngine(config: EngineConfig): SearchEngine {
    const driverName = config.driver

    // Custom engines first
    if (this.customEngines.has(driverName)) {
      return this.customEngines.get(driverName)!(config)
    }

    // Built-in engines
    if (this.builtInEngines.has(driverName)) {
      return this.builtInEngines.get(driverName)!(config)
    }

    throw new SearchError(`Unsupported search driver "${driverName}"`, { driver: driverName })
  }
}
