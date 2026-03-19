import { Watcher } from '../contracts/Watcher.ts'
import type { LogEntryContent } from '../contracts/Entry.ts'

const LOG_LEVEL_VALUES: Record<string, number> = {
  emergency: 0,
  alert: 1,
  critical: 2,
  error: 3,
  warning: 4,
  notice: 5,
  info: 6,
  debug: 7,
}

/**
 * Records log entries from @mantiq/logging.
 *
 * Filters by minimum log level to avoid recording debug noise in production.
 */
export class LogWatcher extends Watcher {
  override register(): void {
    // LogWatcher is driven by wrapping LogManager.
    // HeartbeatServiceProvider intercepts log calls.
  }

  recordLog(level: string, message: string, context: Record<string, any>, channel: string): void {
    if (!this.isEnabled()) return

    const minLevel = (this.options.level as string) ?? 'debug'
    const minValue = LOG_LEVEL_VALUES[minLevel] ?? 7
    const levelValue = LOG_LEVEL_VALUES[level] ?? 7

    // Lower value = more severe. Only record if level is at or below minimum.
    if (levelValue > minValue) return

    const content: LogEntryContent = {
      level,
      message,
      context,
      channel,
    }

    const tags = [level]
    if (levelValue <= 3) tags.push('error')

    this.record('log', content, tags)
  }
}
