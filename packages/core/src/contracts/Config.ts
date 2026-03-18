export interface Config {
  /**
   * Get a config value using dot-notation.
   * @param key - Dot-notation key: 'database.connections.sqlite.path'
   * @param defaultValue - Returned if key doesn't exist
   * @throws ConfigKeyNotFoundError if key doesn't exist and no default provided
   */
  get<T = any>(key: string, defaultValue?: T): T

  /**
   * Set a config value at runtime (not persisted).
   */
  set(key: string, value: any): void

  /**
   * Check if a key exists.
   */
  has(key: string): boolean

  /**
   * Get all config as a flat object.
   */
  all(): Record<string, any>
}
