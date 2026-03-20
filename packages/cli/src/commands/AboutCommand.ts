import { Command } from '../Command.ts'
import type { ParsedArgs } from '../Parser.ts'

export class AboutCommand extends Command {
  override name = 'about'
  override description = 'Display information about the framework'

  override async handle(_args: ParsedArgs): Promise<number> {
    const env = process.env

    this.io.brand()

    // Environment
    this.io.info('  Environment')
    this.io.line('')
    this.printRow('Application Name', env.APP_NAME || 'MantiqJS')
    this.printRow('Environment', env.APP_ENV || 'production')
    this.printRow('Debug Mode', env.APP_DEBUG === 'true' ? this.io.yellow('ENABLED') : 'disabled')
    this.printRow('URL', env.APP_URL || 'http://localhost:3000')
    this.printRow('Port', env.APP_PORT || '3000')
    this.io.line('')

    // Runtime
    this.io.info('  Runtime')
    this.io.line('')
    this.printRow('Bun', Bun.version)
    this.printRow('TypeScript', 'ESNext')
    this.printRow('Platform', `${process.platform} ${process.arch}`)
    this.printRow('PID', String(process.pid))
    this.printRow('Memory', `${Math.round(process.memoryUsage.rss() / 1024 / 1024)} MB RSS`)
    this.io.line('')

    // Database
    this.io.info('  Database')
    this.io.line('')
    this.printRow('Connection', env.DB_CONNECTION || 'sqlite')
    this.printRow('Database', env.DB_DATABASE || 'database/database.sqlite')
    this.io.line('')

    // Services
    this.io.info('  Services')
    this.io.line('')
    this.printRow('Cache', env.CACHE_DRIVER || 'memory')
    this.printRow('Queue', env.QUEUE_CONNECTION || 'sync')
    this.printRow('Logging', env.LOG_CHANNEL || 'stack')
    this.printRow('Session', env.SESSION_DRIVER || 'cookie')
    this.io.line('')

    // Packages
    this.io.info('  Installed Packages')
    this.io.line('')
    const packages = [
      'core', 'database', 'auth', 'cli', 'validation', 'helpers',
      'filesystem', 'logging', 'events', 'queue', 'realtime', 'heartbeat', 'vite',
    ]
    for (const pkg of packages) {
      try {
        require.resolve(`@mantiq/${pkg}`)
        this.io.line(`    ${this.io.emerald('●')} @mantiq/${pkg}`)
      } catch {
        this.io.line(`    ${this.io.gray('○')} @mantiq/${pkg}`)
      }
    }
    this.io.line('')

    return 0
  }

  private printRow(label: string, value: string): void {
    this.io.line(`    ${this.io.gray(label.padEnd(22))} ${value}`)
  }
}
