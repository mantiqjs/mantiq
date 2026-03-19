import type { EntryType } from './Entry.ts'
import type { Heartbeat } from '../Heartbeat.ts'

type EventRegistrar = (eventClass: any, handler: (event: any) => void) => void
type WildcardRegistrar = (handler: (event: any) => void) => void

/**
 * Abstract base class for all Heartbeat watchers.
 *
 * Watchers listen to framework events and record telemetry entries
 * via the Heartbeat orchestrator, which buffers and dispatches them
 * to the dedicated heartbeat queue.
 */
export abstract class Watcher {
  protected heartbeat!: Heartbeat
  protected enabled = true
  protected options: Record<string, any> = {}

  setHeartbeat(heartbeat: Heartbeat): void {
    this.heartbeat = heartbeat
  }

  configure(options: Record<string, any>): void {
    this.options = options
  }

  isEnabled(): boolean {
    return this.enabled
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  /**
   * Register event listeners for this watcher.
   * @param on  - Register a listener for a specific event class
   * @param onAny - Register a wildcard listener for all events
   */
  abstract register(on: EventRegistrar, onAny: WildcardRegistrar): void

  /**
   * Convenience — record a telemetry entry via the Heartbeat orchestrator.
   */
  protected record(type: EntryType, content: Record<string, any>, tags?: string[]): void {
    this.heartbeat.record(type, content, tags)
  }
}
