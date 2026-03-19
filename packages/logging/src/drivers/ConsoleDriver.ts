import type { LogLevel, LogEntry, LogFormatter, LoggerDriver } from '../contracts/Logger.ts'
import { LOG_LEVELS } from '../contracts/Logger.ts'
import { LineFormatter } from '../formatters/LineFormatter.ts'

export class ConsoleDriver implements LoggerDriver {
  private readonly minLevel: number
  private readonly formatter: LogFormatter
  private readonly channelName: string

  constructor(channel: string = 'console', minLevel: LogLevel = 'debug', formatter?: LogFormatter) {
    this.channelName = channel
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

    const formatted = this.formatter.format(entry)

    // Use stderr for error-level and above, stdout for the rest
    if (LOG_LEVELS[level] <= LOG_LEVELS.error) {
      process.stderr.write(formatted + '\n')
    } else {
      process.stdout.write(formatted + '\n')
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
