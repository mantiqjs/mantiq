import type { LogEntry, LogFormatter } from '../contracts/Logger.ts'

export class JsonFormatter implements LogFormatter {
  format(entry: LogEntry): string {
    return JSON.stringify({
      timestamp: entry.timestamp.toISOString(),
      channel: entry.channel,
      level: entry.level,
      message: entry.message,
      ...(Object.keys(entry.context).length > 0 ? { context: entry.context } : {}),
    })
  }
}
