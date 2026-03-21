import { HealthCheck } from '../HealthCheck.ts'

/**
 * Verifies the cache driver can read and write.
 * Writes a test key, reads it back, then deletes it.
 */
export class CacheCheck extends HealthCheck {
  readonly name = 'cache'

  constructor(private cache: any) {
    super()
  }

  override async run(): Promise<void> {
    if (!this.cache) throw new Error('Cache instance is null')

    const driver = this.cache.getDefaultDriver?.() ?? this.cache.driver?.() ?? 'unknown'
    this.meta('driver', typeof driver === 'string' ? driver : 'unknown')

    const key = `__health_check_${Date.now()}`
    const value = 'ok'

    await this.cache.put(key, value, 10) // 10 seconds TTL
    const read = await this.cache.get(key)

    if (read !== value) {
      throw new Error(`Cache write/read mismatch: wrote "${value}", got "${read}"`)
    }

    await this.cache.forget(key)
  }
}
