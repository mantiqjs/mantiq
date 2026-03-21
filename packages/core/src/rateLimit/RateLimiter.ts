/**
 * Rate limiter — tracks request counts per key within time windows.
 *
 * Supports named limiters with custom resolvers, and pluggable stores
 * (memory by default, cache/Redis when available).
 *
 * @example
 * const limiter = new RateLimiter()
 *
 * // Define a named limiter
 * limiter.for('api', (request) => ({
 *   key: request.ip(),
 *   maxAttempts: 60,
 *   decayMinutes: 1,
 * }))
 *
 * // Or with multiple limits
 * limiter.for('uploads', (request) => [
 *   { key: request.ip(), maxAttempts: 10, decayMinutes: 1 },
 *   { key: request.user()?.id ?? request.ip(), maxAttempts: 100, decayMinutes: 60 },
 * ])
 */

export interface RateLimitConfig {
  key: string
  maxAttempts: number
  decayMinutes: number
  responseCallback?: (request: any, headers: Record<string, string>) => Response | void
}

export interface RateLimitStore {
  /** Get current hit count for key. */
  get(key: string): Promise<number>
  /** Increment hit count. Returns new count. */
  increment(key: string, decaySeconds: number): Promise<number>
  /** Get remaining seconds until the key resets. */
  availableIn(key: string): Promise<number>
  /** Reset a key. */
  clear(key: string): Promise<void>
}

export type LimiterResolver = (request: any) => RateLimitConfig | RateLimitConfig[]

export class RateLimiter {
  private limiters = new Map<string, LimiterResolver>()
  private store: RateLimitStore

  constructor(store?: RateLimitStore) {
    this.store = store ?? new MemoryStore()
  }

  /** Define a named rate limiter. */
  for(name: string, resolver: LimiterResolver): this {
    this.limiters.set(name, resolver)
    return this
  }

  /** Get a named limiter resolver. */
  limiter(name: string): LimiterResolver | undefined {
    return this.limiters.get(name)
  }

  /** Check if a key has too many attempts. */
  async tooManyAttempts(key: string, maxAttempts: number): Promise<boolean> {
    const attempts = await this.store.get(key)
    return attempts >= maxAttempts
  }

  /** Record a hit for a key. Returns the new count. */
  async hit(key: string, decaySeconds: number): Promise<number> {
    return this.store.increment(key, decaySeconds)
  }

  /** Get current attempt count. */
  async attempts(key: string): Promise<number> {
    return this.store.get(key)
  }

  /** Get remaining attempts. */
  async remaining(key: string, maxAttempts: number): Promise<number> {
    const current = await this.store.get(key)
    return Math.max(0, maxAttempts - current)
  }

  /** Get seconds until the rate limit resets. */
  async availableIn(key: string): Promise<number> {
    return this.store.availableIn(key)
  }

  /** Reset a key's attempt count. */
  async clear(key: string): Promise<void> {
    return this.store.clear(key)
  }

  /** Set the backing store (memory, cache, redis). */
  setStore(store: RateLimitStore): void {
    this.store = store
  }
}

// ── Memory Store (default) ───────────────────────────────────────────────────

interface MemoryEntry {
  count: number
  expiresAt: number // unix ms
}

export class MemoryStore implements RateLimitStore {
  private entries = new Map<string, MemoryEntry>()

  async get(key: string): Promise<number> {
    const entry = this.entries.get(key)
    if (!entry) return 0
    if (Date.now() > entry.expiresAt) {
      this.entries.delete(key)
      return 0
    }
    return entry.count
  }

  async increment(key: string, decaySeconds: number): Promise<number> {
    const existing = this.entries.get(key)
    const now = Date.now()

    if (existing && now <= existing.expiresAt) {
      existing.count++
      return existing.count
    }

    // New window
    const entry: MemoryEntry = { count: 1, expiresAt: now + decaySeconds * 1000 }
    this.entries.set(key, entry)
    return 1
  }

  async availableIn(key: string): Promise<number> {
    const entry = this.entries.get(key)
    if (!entry) return 0
    const remaining = Math.ceil((entry.expiresAt - Date.now()) / 1000)
    return Math.max(0, remaining)
  }

  async clear(key: string): Promise<void> {
    this.entries.delete(key)
  }
}
