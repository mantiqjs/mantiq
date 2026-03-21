import { ServiceProvider, ConfigRepository, Application } from '@mantiq/core'
import type { LogConfig } from './contracts/Logger.ts'
import { LogManager } from './LogManager.ts'
import { LOGGING_MANAGER } from './helpers/log.ts'

const DEFAULT_CONFIG: LogConfig = {
  default: 'stack',
  channels: {
    stack: {
      driver: 'stack',
      channels: ['console', 'daily'],
    },
    console: {
      driver: 'console',
      level: 'debug',
    },
    daily: {
      driver: 'daily',
      path: 'storage/logs/mantiq.log',
      level: 'debug',
      days: 14,
    },
    file: {
      driver: 'file',
      path: 'storage/logs/mantiq.log',
      level: 'debug',
    },
    null: {
      driver: 'null',
    },
  },
}

export class LoggingServiceProvider extends ServiceProvider {
  override register(): void {
    this.app.singleton(LogManager, (c) => {
      const config = c.make(ConfigRepository).get<LogConfig>('logging', DEFAULT_CONFIG)

      // Resolve relative log paths to absolute from app base path
      const basePath = (this.app.make(Application as any) as Application).basePath_()
      if (config.channels) {
        for (const ch of Object.values(config.channels)) {
          if (typeof ch.path === 'string' && !ch.path.startsWith('/')) {
            ch.path = `${basePath}/${ch.path}`
          }
        }
      }

      return new LogManager(config)
    })

    this.app.alias(LogManager, LOGGING_MANAGER)
  }
}
