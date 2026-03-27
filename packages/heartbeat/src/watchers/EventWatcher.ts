import { Watcher } from '../contracts/Watcher.ts'
import type { EventEntryContent } from '../contracts/Entry.ts'

/**
 * Records all dispatched events via the wildcard (onAny) listener.
 *
 * Filters out internal framework events and Heartbeat's own events.
 */
export class EventWatcher extends Watcher {
  private static readonly INTERNAL_PREFIXES = [
    'RecordHeartbeatEntries',
    'HeartbeatMetrics',
    'QueryExecuted',
    'TransactionBeginning',
    'TransactionCommitted',
    'TransactionRolledBack',
    'MigrationStarted',
    'MigrationEnded',
    'RouteMatched',
    'CacheHit',
    'CacheMissed',
    'KeyWritten',
    'KeyForgotten',
  ]

  override register(_on: (eventClass: any, handler: (event: any) => void) => void, onAny: (handler: (event: any) => void) => void): void {
    onAny((event: any) => this.handleEvent(event))
  }

  private handleEvent(event: any): void {
    if (!this.isEnabled()) return

    const eventClass = event?.constructor?.name ?? 'UnknownEvent'

    // Skip internal events
    if (EventWatcher.INTERNAL_PREFIXES.some((prefix) => eventClass.startsWith(prefix))) return

    // Skip ignored events
    const ignore = (this.options.ignore as string[]) ?? []
    if (ignore.includes(eventClass)) return

    const content: EventEntryContent = {
      event_class: eventClass,
      listeners_count: 0, // populated by the dispatcher if available
      payload: null,
      listeners: [],
    }

    this.record('event', content, [eventClass])
  }
}
