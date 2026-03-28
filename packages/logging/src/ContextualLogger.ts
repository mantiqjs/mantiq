import type { LogLevel, LoggerDriver } from './contracts/Logger.ts'

type LogContext = Record<string, any>

/**
 * A logger wrapper that merges persistent context into every log entry.
 *
 * Created via `log('channel').withContext({ requestId: '123' })`.
 * Each call to `withContext()` returns a new instance so contexts can be
 * nested without mutating the parent.
 */
export class ContextualLogger implements LoggerDriver {
  constructor(
    private readonly driver: LoggerDriver,
    private readonly ctx: LogContext,
  ) {}

  /** Create a child logger with additional context merged in. */
  withContext(context: LogContext): ContextualLogger {
    return new ContextualLogger(this.driver, { ...this.ctx, ...context })
  }

  log(level: LogLevel, message: string, context: Record<string, any> = {}): void {
    this.driver.log(level, message, { ...this.ctx, ...context })
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
