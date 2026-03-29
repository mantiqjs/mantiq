import type { CacheStore } from '../contracts/Cache.ts'
import { join } from 'node:path'
import { mkdir, rm, readdir, rename } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'

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

  /**
   * Fix #194: Atomic increment using write-to-temp + rename to prevent
   * TOCTOU race conditions where concurrent increments could lose updates.
   */
  async increment(key: string, value = 1): Promise<number> {
    await this.ensureDirectory()
    const targetPath = this.path(key)
    const file = Bun.file(targetPath)

    let current = 0
    if (await file.exists()) {
      try {
        const payload: FileCachePayload = await file.json()
        if (payload.expiresAt !== null && Date.now() > payload.expiresAt) {
          // Expired — treat as 0
        } else {
          current = (payload.value as number) ?? 0
        }
      } catch {
        // Corrupted file — start from 0
      }
    }

    const newValue = current + value

    // Atomic write: temp file + rename to avoid partial reads by concurrent operations
    const tmpPath = join(this.directory, `_tmp_${randomBytes(8).toString('hex')}.cache`)
    const payload: FileCachePayload = { value: newValue, expiresAt: null }
    await Bun.write(tmpPath, JSON.stringify(payload))

    try {
      await rename(tmpPath, targetPath)
    } catch {
      try { await rm(tmpPath) } catch { /* ignore */ }
    }

    return newValue
  }

  async decrement(key: string, value = 1): Promise<number> {
    return this.increment(key, -value)
  }

  /**
   * Store an item in the cache if the key does not already exist.
   *
   * Uses write-to-temp + rename to avoid TOCTOU race conditions.
   * If the key already exists (and is not expired), returns false.
   */
  async add(key: string, value: unknown, ttl?: number): Promise<boolean> {
    await this.ensureDirectory()

    const targetPath = this.path(key)

    // Check if key already exists and is not expired
    const file = Bun.file(targetPath)
    if (await file.exists()) {
      try {
        const payload: FileCachePayload = await file.json()
        if (payload.expiresAt === null || Date.now() <= payload.expiresAt) {
          return false
        }
        // Expired — fall through to overwrite
      } catch {
        // Corrupted file — fall through to overwrite
      }
    }

    // Write to a temp file first, then atomically rename into place
    const tmpPath = join(this.directory, `_tmp_${randomBytes(8).toString('hex')}.cache`)
    const payload: FileCachePayload = {
      value,
      expiresAt: ttl != null ? Date.now() + ttl * 1000 : null,
    }
    await Bun.write(tmpPath, JSON.stringify(payload))

    try {
      await rename(tmpPath, targetPath)
    } catch {
      // Cleanup temp file on failure
      try { await rm(tmpPath) } catch { /* ignore */ }
      return false
    }

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
