import type { LogEntry, LogFormatter } from '../contracts/Logger.ts'

export class LineFormatter implements LogFormatter {
  format(entry: LogEntry): string {
    const ts = entry.timestamp.toISOString()
    const level = entry.level.toUpperCase().padEnd(9)
    const ctx = Object.keys(entry.context).length > 0
      ? ' ' + JSON.stringify(entry.context)
      : ''
    return `[${ts}] ${entry.channel}.${level} ${entry.message}${ctx}`
  }
}
