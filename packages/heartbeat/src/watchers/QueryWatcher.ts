import { Watcher } from '../contracts/Watcher.ts'
import type { QueryEntryContent } from '../contracts/Entry.ts'
import { normalizeQuery } from '../helpers/fingerprint.ts'
import { QueryExecuted } from '@mantiq/database'

/**
 * Records database query execution data.
 *
 * Listens to QueryExecuted events from @mantiq/database.
 * Detects slow queries and N+1 patterns.
 */
export class QueryWatcher extends Watcher {
  private recentQueries = new Map<string, { count: number; firstSeen: number }>()
  private readonly N_PLUS_ONE_WINDOW = 100 // ms
  private readonly N_PLUS_ONE_THRESHOLD = 5 // repeated queries

  override register(on: (eventClass: any, handler: (event: any) => void) => void): void {
    on(QueryExecuted, (event: any) => this.handleQueryExecuted(event))
  }

  /** Skip queries against Heartbeat's own tables to prevent infinite recursion. */
  private static readonly INTERNAL_TABLE_PATTERN = /\bheartbeat_\w+/i

  private handleQueryExecuted(event: {
    sql: string
    bindings: any[]
    time: number
    connectionName: string
  }): void {
    if (!this.isEnabled()) return

    // Ignore Heartbeat's own internal queries
    if (QueryWatcher.INTERNAL_TABLE_PATTERN.test(event.sql)) return

    const slowThreshold = (this.options.slow_threshold as number) ?? 100
    const detectNPlusOne = (this.options.detect_n_plus_one as boolean) ?? true
    const normalized = normalizeQuery(event.sql)
    const isSlow = event.time > slowThreshold

    // N+1 detection
    let isNPlusOne = false
    if (detectNPlusOne) {
      isNPlusOne = this.detectNPlusOne(normalized)
    }

    const tags: string[] = []
    if (isSlow) tags.push('slow')
    if (isNPlusOne) tags.push('n+1')

    const content: QueryEntryContent = {
      sql: event.sql,
      normalized_sql: normalized,
      bindings: event.bindings,
      duration: event.time,
      connection: event.connectionName,
      slow: isSlow,
      n_plus_one: isNPlusOne,
      caller: this.getCaller(),
    }

    this.record('query', content, tags)
  }

  private detectNPlusOne(normalizedSql: string): boolean {
    const now = Date.now()

    // Clean up old entries
    for (const [key, entry] of this.recentQueries) {
      if (now - entry.firstSeen > this.N_PLUS_ONE_WINDOW) {
        this.recentQueries.delete(key)
      }
    }

    const existing = this.recentQueries.get(normalizedSql)
    if (existing) {
      existing.count++
      return existing.count >= this.N_PLUS_ONE_THRESHOLD
    }

    this.recentQueries.set(normalizedSql, { count: 1, firstSeen: now })
    return false
  }

  private getCaller(): string | null {
    const stack = new Error().stack
    if (!stack) return null

    const lines = stack.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (
        trimmed.startsWith('at ') &&
        !trimmed.includes('QueryWatcher') &&
        !trimmed.includes('Watcher') &&
        !trimmed.includes('Heartbeat') &&
        !trimmed.includes('node:') &&
        !trimmed.includes('bun:')
      ) {
        return trimmed.replace(/^at /, '')
      }
    }
    return null
  }
}
