export interface DriverManager<T> {
  /**
   * Get a driver instance by name. Returns the default driver if omitted.
   */
  driver(name?: string): T

  /**
   * Register a custom driver factory.
   */
  extend(name: string, factory: () => T): void

  /**
   * Returns the configured default driver name.
   */
  getDefaultDriver(): string
}
