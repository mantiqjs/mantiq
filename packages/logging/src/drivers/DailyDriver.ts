import { appendFile, mkdir, readdir, rm } from 'node:fs/promises'
import { dirname, join, basename } from 'node:path'
import type { LogLevel, LogEntry, LogFormatter, LoggerDriver } from '../contracts/Logger.ts'
import { LOG_LEVELS } from '../contracts/Logger.ts'
import { LineFormatter } from '../formatters/LineFormatter.ts'

export class DailyDriver implements LoggerDriver {
  private readonly basePath: string
  private readonly days: number
  private readonly minLevel: number
  private readonly formatter: LogFormatter
  private readonly channelName: string
  private _lastDate: string = ''
  private _currentPath: string = ''
  private _dirEnsured = false
  private _pruned = false

  constructor(
    channel: string,
    basePath: string,
    minLevel: LogLevel = 'debug',
    days: number = 14,
    formatter?: LogFormatter,
  ) {
    this.channelName = channel
    this.basePath = basePath
    this.days = days
    this.minLevel = LOG_LEVELS[minLevel]
    this.formatter = formatter ?? new LineFormatter()
  }

  log(level: LogLevel, message: string, context: Record<string, any> = {}): void {
    if (LOG_LEVELS[level] > this.minLevel) return

    const entry: LogEntry = {
      level,
      message,
      context,
      timestamp: new Date(),
      channel: this.channelName,
    }

    const line = this.formatter.format(entry) + '\n'
    void this.writeLine(line, entry.timestamp)
  }

  private async writeLine(line: string, now: Date): Promise<void> {
    const dateStr = now.toISOString().slice(0, 10) // YYYY-MM-DD
    if (dateStr !== this._lastDate) {
      this._lastDate = dateStr
      this._currentPath = this.pathForDate(dateStr)
      this._dirEnsured = false
    }

    if (!this._dirEnsured) {
      await mkdir(dirname(this._currentPath), { recursive: true })
      this._dirEnsured = true
    }

    await appendFile(this._currentPath, line)

    if (!this._pruned) {
      this._pruned = true
      void this.pruneOldFiles()
    }
  }

  private pathForDate(dateStr: string): string {
    // e.g., /storage/logs/mantiq-2024-03-19.log
    const dir = dirname(this.basePath)
    const name = basename(this.basePath, '.log')
    return join(dir, `${name}-${dateStr}.log`)
  }

  private async pruneOldFiles(): Promise<void> {
    const dir = dirname(this.basePath)
    const prefix = basename(this.basePath, '.log')
    const cutoff = Date.now() - this.days * 86400000

    try {
      const entries = await readdir(dir)
      for (const entry of entries) {
        // Match files like mantiq-2024-03-19.log
        const match = entry.match(new RegExp(`^${escapeRegExp(prefix)}-(\\d{4}-\\d{2}-\\d{2})\\.log$`))
        if (match) {
          const fileDate = new Date(match[1]! + 'T00:00:00Z')
          if (fileDate.getTime() < cutoff) {
            await rm(join(dir, entry)).catch(() => {})
          }
        }
      }
    } catch {
      // Pruning is best-effort
    }
  }

  emergency(message: string, context?: Record<string, any>): void { this.log('emergency', message, context) }
  alert(message: string, context?: Record<string, any>): void { this.log('alert', message, context) }
  critical(message: string, context?: Record<string, any>): void { this.log('critical', message, context) }
  error(message: string, context?: Record<string, any>): void { this.log('error', message, context) }
  warning(message: string, context?: Record<string, any>): void { this.log('warning', message, context) }
  notice(message: string, context?: Record<string, any>): void { this.log('notice', message, context) }
  info(message: string, context?: Record<string, any>): void { this.log('info', message, context) }
  debug(message: string, context?: Record<string, any>): void { this.log('debug', message, context) }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
