import type { LogLevel, LoggerDriver } from '../contracts/Logger.ts'

export class StackDriver implements LoggerDriver {
  private readonly drivers: LoggerDriver[]

  constructor(drivers: LoggerDriver[]) {
    this.drivers = drivers
  }

  log(level: LogLevel, message: string, context?: Record<string, any>): void {
    for (const driver of this.drivers) {
      driver.log(level, message, context)
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
