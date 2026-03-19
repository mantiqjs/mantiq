import type { LogLevel, LoggerDriver } from '../contracts/Logger.ts'
import { LOG_LEVELS } from '../contracts/Logger.ts'

export interface LoggedMessage {
  level: LogLevel
  message: string
  context: Record<string, any>
}

export class LogFake implements LoggerDriver {
  private readonly logged: LoggedMessage[] = []

  log(level: LogLevel, message: string, context: Record<string, any> = {}): void {
    this.logged.push({ level, message, context })
  }

  emergency(message: string, context?: Record<string, any>): void { this.log('emergency', message, context ?? {}) }
  alert(message: string, context?: Record<string, any>): void { this.log('alert', message, context ?? {}) }
  critical(message: string, context?: Record<string, any>): void { this.log('critical', message, context ?? {}) }
  error(message: string, context?: Record<string, any>): void { this.log('error', message, context ?? {}) }
  warning(message: string, context?: Record<string, any>): void { this.log('warning', message, context ?? {}) }
  notice(message: string, context?: Record<string, any>): void { this.log('notice', message, context ?? {}) }
  info(message: string, context?: Record<string, any>): void { this.log('info', message, context ?? {}) }
  debug(message: string, context?: Record<string, any>): void { this.log('debug', message, context ?? {}) }

  // ── Assertions ────────────────────────────────────────────────────────────

  assertLogged(level: LogLevel, message?: string | RegExp, count?: number): void {
    const matches = this.matching(level, message)
    if (matches.length === 0) {
      throw new Error(
        `Expected log at level [${level}]${message ? ` matching "${message}"` : ''} but none was found.\n` +
        `Logged messages: ${JSON.stringify(this.logged, null, 2)}`,
      )
    }
    if (count !== undefined && matches.length !== count) {
      throw new Error(
        `Expected ${count} log(s) at level [${level}]${message ? ` matching "${message}"` : ''} but found ${matches.length}.`,
      )
    }
  }

  assertNotLogged(level: LogLevel, message?: string | RegExp): void {
    const matches = this.matching(level, message)
    if (matches.length > 0) {
      throw new Error(
        `Unexpected log at level [${level}]${message ? ` matching "${message}"` : ''} was found.\n` +
        `Match: ${JSON.stringify(matches[0])}`,
      )
    }
  }

  assertNothingLogged(): void {
    if (this.logged.length > 0) {
      throw new Error(
        `Expected no logs but ${this.logged.length} were recorded.\n` +
        `First: ${JSON.stringify(this.logged[0])}`,
      )
    }
  }

  assertLoggedCount(count: number): void {
    if (this.logged.length !== count) {
      throw new Error(`Expected ${count} log(s) but ${this.logged.length} were recorded.`)
    }
  }

  // ── Inspection ────────────────────────────────────────────────────────────

  all(): LoggedMessage[] {
    return [...this.logged]
  }

  forLevel(level: LogLevel): LoggedMessage[] {
    return this.logged.filter((m) => m.level === level)
  }

  hasLogged(level: LogLevel, message?: string | RegExp): boolean {
    return this.matching(level, message).length > 0
  }

  reset(): void {
    this.logged.length = 0
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private matching(level: LogLevel, message?: string | RegExp): LoggedMessage[] {
    return this.logged.filter((m) => {
      if (m.level !== level) return false
      if (message === undefined) return true
      if (typeof message === 'string') return m.message === message
      return message.test(m.message)
    })
  }
}
