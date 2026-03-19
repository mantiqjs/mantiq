import type { LogLevel, LoggerDriver } from '../contracts/Logger.ts'

export class NullDriver implements LoggerDriver {
  log(_level: LogLevel, _message: string, _context?: Record<string, any>): void {}
  emergency(_message: string, _context?: Record<string, any>): void {}
  alert(_message: string, _context?: Record<string, any>): void {}
  critical(_message: string, _context?: Record<string, any>): void {}
  error(_message: string, _context?: Record<string, any>): void {}
  warning(_message: string, _context?: Record<string, any>): void {}
  notice(_message: string, _context?: Record<string, any>): void {}
  info(_message: string, _context?: Record<string, any>): void {}
  debug(_message: string, _context?: Record<string, any>): void {}
}
