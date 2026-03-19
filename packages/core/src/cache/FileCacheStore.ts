import type { CacheStore } from '../contracts/Cache.ts'
import { join } from 'node:path'
import { mkdir, rm, readdir } from 'node:fs/promises'

interface FileCachePayload {
  value: unknown
  expiresAt: number | null
}

/**
 * File-based cache store. Survives process restarts.
 * Each key maps to a JSON file in the configured directory.
 */
export class FileCacheStore implements CacheStore {
  private readonly directory: string
  private initialized = false

  constructor(directory: string) {
    this.directory = directory
  }

  async get<T = unknown>(key: string): Promise<T | undefined> {
    await this.ensureDirectory()
    const file = Bun.file(this.path(key))

    if (!(await file.exists())) return undefined

    try {
      const payload: FileCachePayload = await file.json()

      if (payload.expiresAt !== null && Date.now() > payload.expiresAt) {
        await this.forget(key)
        return undefined
      }

      return payload.value as T
    } catch {
      // Corrupted file — remove it
      await this.forget(key)
      return undefined
    }
  }

  async put(key: string, value: unknown, ttl?: number): Promise<void> {
    await this.ensureDirectory()
    const payload: FileCachePayload = {
      value,
      expiresAt: ttl != null ? Date.now() + ttl * 1000 : null,
    }
    await Bun.write(this.path(key), JSON.stringify(payload))
  }

  async forget(key: string): Promise<boolean> {
    try {
      const file = Bun.file(this.path(key))
      if (await file.exists()) {
        await rm(this.path(key))
        return true
      }
      return false
    } catch {
      return false
    }
  }

  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== undefined
  }

  async flush(): Promise<void> {
    try {
      const files = await readdir(this.directory)
      await Promise.all(
        files
          .filter((f) => f.endsWith('.cache'))
          .map((f) => rm(join(this.directory, f))),
      )
    } catch {
      // Directory might not exist yet — that's fine
    }
  }

  async increment(key: string, value = 1): Promise<number> {
    const current = await this.get<number>(key)
    const newValue = (current ?? 0) + value
    await this.put(key, newValue)
    return newValue
  }

  async decrement(key: string, value = 1): Promise<number> {
    return this.increment(key, -value)
  }

  async add(key: string, value: unknown, ttl?: number): Promise<boolean> {
    if (await this.has(key)) return false
    await this.put(key, value, ttl)
    return true
  }

  // ── Internal ────────────────────────────────────────────────────────────

  private path(key: string): string {
    // Hash the key to avoid filesystem issues with special characters
    const safe = Buffer.from(key).toString('hex')
    return join(this.directory, `${safe}.cache`)
  }

  private async ensureDirectory(): Promise<void> {
    if (this.initialized) return
    await mkdir(this.directory, { recursive: true })
    this.initialized = true
  }
}
