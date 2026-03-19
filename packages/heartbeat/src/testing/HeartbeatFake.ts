import type { EntryType, PendingEntry } from '../contracts/Entry.ts'

/**
 * In-memory Heartbeat fake for testing.
 *
 * Records entries without touching SQLite or the queue system.
 * Provides assertion helpers for verifying telemetry in tests.
 */
export class HeartbeatFake {
  private entries: PendingEntry[] = []

  record(type: EntryType, content: Record<string, any>, tags?: string[]): void {
    this.entries.push({
      type,
      content,
      tags,
      requestId: null,
      createdAt: Date.now(),
    })
  }

  // ── Queries ─────────────────────────────────────────────────────────────

  all(): PendingEntry[] {
    return [...this.entries]
  }

  forType(type: EntryType): PendingEntry[] {
    return this.entries.filter((e) => e.type === type)
  }

  hasRecorded(type: EntryType, match?: string | RegExp): boolean {
    const filtered = this.forType(type)
    if (!match) return filtered.length > 0

    return filtered.some((e) => {
      const content = JSON.stringify(e.content)
      if (typeof match === 'string') return content.includes(match)
      return match.test(content)
    })
  }

  // ── Assertions ──────────────────────────────────────────────────────────

  assertRecorded(type: EntryType, match?: string | RegExp, count?: number): void {
    const filtered = this.forType(type)

    if (match) {
      const matching = filtered.filter((e) => {
        const content = JSON.stringify(e.content)
        if (typeof match === 'string') return content.includes(match)
        return match.test(content)
      })

      if (matching.length === 0) {
        throw new Error(`Expected ${type} entry matching "${match}" but none found. Recorded ${type} entries: ${filtered.length}`)
      }

      if (count !== undefined && matching.length !== count) {
        throw new Error(`Expected ${count} ${type} entries matching "${match}" but found ${matching.length}`)
      }
    } else {
      if (filtered.length === 0) {
        throw new Error(`Expected ${type} entry but none found`)
      }
      if (count !== undefined && filtered.length !== count) {
        throw new Error(`Expected ${count} ${type} entries but found ${filtered.length}`)
      }
    }
  }

  assertNotRecorded(type: EntryType, match?: string | RegExp): void {
    if (this.hasRecorded(type, match)) {
      throw new Error(`Unexpected ${type} entry${match ? ` matching "${match}"` : ''} was recorded`)
    }
  }

  assertNothingRecorded(): void {
    if (this.entries.length > 0) {
      throw new Error(`Expected no entries but found ${this.entries.length}`)
    }
  }

  assertRecordedCount(count: number): void {
    if (this.entries.length !== count) {
      throw new Error(`Expected ${count} entries but found ${this.entries.length}`)
    }
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────

  reset(): void {
    this.entries = []
  }
}
