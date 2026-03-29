import { appendFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { LogLevel, LogEntry, LogFormatter, LoggerDriver } from '../contracts/Logger.ts'
import { LOG_LEVELS } from '../contracts/Logger.ts'
import { LineFormatter } from '../formatters/LineFormatter.ts'

export class FileDriver implements LoggerDriver {
  private readonly path: string
  private readonly minLevel: number
  private readonly formatter: LogFormatter
  private readonly channelName: string
  private _dirEnsured = false

  constructor(channel: string, path: string, minLevel: LogLevel = 'debug', formatter?: LogFormatter) {
    this.channelName = channel
    this.path = path
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

    // Fire-and-forget — logging should never block the request.
    // Fix #204: Surface write errors on stderr instead of silently swallowing them.
    void this.writeLine(line).catch((err: Error) =>
      process.stderr.write('Log write failed: ' + err.message + '\n'),
    )
  }

  private async writeLine(line: string): Promise<void> {
    if (!this._dirEnsured) {
      await mkdir(dirname(this.path), { recursive: true })
      this._dirEnsured = true
    }
    await appendFile(this.path, line)
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
