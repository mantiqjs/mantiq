export type LogLevel = 'emergency' | 'alert' | 'critical' | 'error' | 'warning' | 'notice' | 'info' | 'debug'

export const LOG_LEVELS: Record<LogLevel, number> = {
  emergency: 0,
  alert: 1,
  critical: 2,
  error: 3,
  warning: 4,
  notice: 5,
  info: 6,
  debug: 7,
}

export interface LogEntry {
  level: LogLevel
  message: string
  context: Record<string, any>
  timestamp: Date
  channel: string
}

export interface LogFormatter {
  format(entry: LogEntry): string
}

export interface LoggerDriver {
  log(level: LogLevel, message: string, context?: Record<string, any>): void

  emergency(message: string, context?: Record<string, any>): void
  alert(message: string, context?: Record<string, any>): void
  critical(message: string, context?: Record<string, any>): void
  error(message: string, context?: Record<string, any>): void
  warning(message: string, context?: Record<string, any>): void
  notice(message: string, context?: Record<string, any>): void
  info(message: string, context?: Record<string, any>): void
  debug(message: string, context?: Record<string, any>): void
}

export interface ChannelConfig {
  driver: string
  level?: LogLevel
  formatter?: 'line' | 'json'
  [key: string]: unknown
}

export interface LogConfig {
  default: string
  channels: Record<string, ChannelConfig>
}
