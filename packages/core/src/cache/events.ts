import { Event } from '../contracts/EventDispatcher.ts'

/**
 * Fired when a cache key is found (cache hit).
 */
export class CacheHit extends Event {
  constructor(
    public readonly key: string,
    public readonly value: unknown,
    public readonly store: string,
  ) {
    super()
  }
}

/**
 * Fired when a cache key is not found (cache miss).
 */
export class CacheMissed extends Event {
  constructor(
    public readonly key: string,
    public readonly store: string,
  ) {
    super()
  }
}

/**
 * Fired when a value is written to the cache.
 */
export class KeyWritten extends Event {
  constructor(
    public readonly key: string,
    public readonly value: unknown,
    public readonly ttl: number | undefined,
    public readonly store: string,
  ) {
    super()
  }
}

/**
 * Fired when a cache key is removed.
 */
export class KeyForgotten extends Event {
  constructor(
    public readonly key: string,
    public readonly store: string,
  ) {
    super()
  }
}
