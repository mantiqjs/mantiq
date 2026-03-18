import type { Config } from '../contracts/Config.ts'
import { ConfigKeyNotFoundError } from '../errors/ConfigKeyNotFoundError.ts'

export class ConfigRepository implements Config {
  private data: Record<string, any> = {}

  constructor(data: Record<string, any> = {}) {
    this.data = data
  }

  /**
   * Get a config value using dot-notation.
   * @throws ConfigKeyNotFoundError if key doesn't exist and no default is provided
   */
  get<T = any>(key: string, defaultValue?: T): T {
    const value = this.getByDotNotation(this.data, key)

    if (value === undefined) {
      if (defaultValue !== undefined) return defaultValue
      throw new ConfigKeyNotFoundError(key)
    }

    return value as T
  }

  set(key: string, value: any): void {
    this.setByDotNotation(this.data, key, value)
  }

  has(key: string): boolean {
    return this.getByDotNotation(this.data, key) !== undefined
  }

  all(): Record<string, any> {
    return { ...this.data }
  }

  /**
   * Load config from a directory of TypeScript/JS config files.
   * Each file's default export becomes a top-level key named after the file.
   */
  static async fromDirectory(configPath: string): Promise<ConfigRepository> {
    const data: Record<string, any> = {}

    try {
      const glob = new Bun.Glob('*.ts')
      for await (const file of glob.scan(configPath)) {
        const key = file.replace(/\.ts$/, '')
        try {
          const mod = await import(`${configPath}/${file}`)
          data[key] = mod.default ?? mod
        } catch {
          // Skip files that fail to load
        }
      }
    } catch {
      // Config directory doesn't exist — use empty config
    }

    return new ConfigRepository(data)
  }

  /**
   * Load from a cached JSON file (production optimization).
   */
  static fromCache(cachePath: string): ConfigRepository {
    try {
      const file = Bun.file(cachePath)
      const json = JSON.parse(new TextDecoder().decode(file.arrayBuffer() as any))
      return new ConfigRepository(json)
    } catch {
      return new ConfigRepository()
    }
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private getByDotNotation(obj: Record<string, any>, key: string): any {
    if (!key.includes('.')) {
      return obj[key]
    }

    const parts = key.split('.')
    let current: any = obj

    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined
      }
      current = current[part]
    }

    return current
  }

  private setByDotNotation(obj: Record<string, any>, key: string, value: any): void {
    if (!key.includes('.')) {
      obj[key] = value
      return
    }

    const parts = key.split('.')
    let current = obj

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]!
      if (current[part] === undefined || typeof current[part] !== 'object') {
        current[part] = {}
      }
      current = current[part]
    }

    current[parts[parts.length - 1]!] = value
  }
}
