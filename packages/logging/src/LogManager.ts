import type { DriverManager } from '@mantiq/core'
import type { LogLevel, LoggerDriver, LogConfig, ChannelConfig, LogFormatter } from './contracts/Logger.ts'
import { ConsoleDriver } from './drivers/ConsoleDriver.ts'
import { FileDriver } from './drivers/FileDriver.ts'
import { DailyDriver } from './drivers/DailyDriver.ts'
import { StackDriver } from './drivers/StackDriver.ts'
import { NullDriver } from './drivers/NullDriver.ts'
import { LineFormatter } from './formatters/LineFormatter.ts'
import { JsonFormatter } from './formatters/JsonFormatter.ts'

export class LogManager implements DriverManager<LoggerDriver>, LoggerDriver {
  private readonly config: LogConfig
  private readonly channels = new Map<string, LoggerDriver>()
  private readonly customCreators = new Map<string, (config: ChannelConfig) => LoggerDriver>()

  constructor(config?: Partial<LogConfig>) {
    this.config = {
      default: config?.default ?? 'console',
      channels: config?.channels ?? {},
    }
  }

  // ── DriverManager ─────────────────────────────────────────────────────────

  driver(name?: string): LoggerDriver {
    const channelName = name ?? this.getDefaultDriver()

    if (!this.channels.has(channelName)) {
      this.channels.set(channelName, this.createDriver(channelName))
    }

    return this.channels.get(channelName)!
  }

  channel(name?: string): LoggerDriver {
    return this.driver(name)
  }

  extend(name: string, factory: (config: ChannelConfig) => LoggerDriver): void {
    this.customCreators.set(name, factory)
  }

  getDefaultDriver(): string {
    return this.config.default
  }

  forgetChannel(name: string): void {
    this.channels.delete(name)
  }

  forgetChannels(): void {
    this.channels.clear()
  }

  // ── LoggerDriver (delegates to default channel) ───────────────────────────

  log(level: LogLevel, message: string, context?: Record<string, any>): void {
    this.driver().log(level, message, context)
  }

  emergency(message: string, context?: Record<string, any>): void { this.driver().emergency(message, context) }
  alert(message: string, context?: Record<string, any>): void { this.driver().alert(message, context) }
  critical(message: string, context?: Record<string, any>): void { this.driver().critical(message, context) }
  error(message: string, context?: Record<string, any>): void { this.driver().error(message, context) }
  warning(message: string, context?: Record<string, any>): void { this.driver().warning(message, context) }
  notice(message: string, context?: Record<string, any>): void { this.driver().notice(message, context) }
  info(message: string, context?: Record<string, any>): void { this.driver().info(message, context) }
  debug(message: string, context?: Record<string, any>): void { this.driver().debug(message, context) }

  // ── Internal ──────────────────────────────────────────────────────────────

  private createDriver(name: string): LoggerDriver {
    const channelConfig = this.config.channels[name]
    const driverName = channelConfig?.driver ?? name

    const custom = this.customCreators.get(driverName)
    if (custom) return custom(channelConfig ?? { driver: driverName })

    if (!channelConfig && driverName === 'console') {
      return new ConsoleDriver('console', 'debug')
    }

    if (!channelConfig) {
      throw new Error(`Logging channel "${name}" is not configured. Define it in config/logging.ts or use extend().`)
    }

    const formatter = this.resolveFormatter(channelConfig)

    switch (driverName) {
      case 'console':
        return new ConsoleDriver(
          name,
          channelConfig.level ?? 'debug',
          formatter,
        )

      case 'file':
        return new FileDriver(
          name,
          channelConfig.path as string ?? 'storage/logs/mantiq.log',
          channelConfig.level ?? 'debug',
          formatter,
        )

      case 'daily':
        return new DailyDriver(
          name,
          channelConfig.path as string ?? 'storage/logs/mantiq.log',
          channelConfig.level ?? 'debug',
          (channelConfig.days as number) ?? 14,
          formatter,
        )

      case 'stack': {
        const channelNames = (channelConfig.channels as string[]) ?? []
        const drivers = channelNames.map((ch) => this.driver(ch))
        return new StackDriver(drivers)
      }

      case 'null':
        return new NullDriver()

      default:
        throw new Error(`Unsupported logging driver: "${driverName}". Use extend() to register custom drivers.`)
    }
  }

  private resolveFormatter(config: ChannelConfig): LogFormatter | undefined {
    if (config.formatter === 'json') return new JsonFormatter()
    if (config.formatter === 'line') return new LineFormatter()
    return undefined
  }
}
