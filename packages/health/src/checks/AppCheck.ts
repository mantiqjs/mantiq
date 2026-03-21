import { HealthCheck } from '../HealthCheck.ts'

/**
 * Verifies core application components are booted and functional.
 * Checks: config loaded, encryption key set, app instance exists.
 */
export class AppCheck extends HealthCheck {
  readonly name = 'app'

  constructor(private app: any) {
    super()
  }

  override async run(): Promise<void> {
    if (!this.app) throw new Error('Application instance is null')

    // Check container is functional
    try {
      const name = this.app.config?.('app.name') ?? this.app.make?.('config')?.get?.('app.name')
      this.meta('name', name ?? 'unknown')
    } catch {
      this.degrade('Config not accessible')
    }

    // Check environment
    this.meta('env', process.env['APP_ENV'] ?? process.env['NODE_ENV'] ?? 'unknown')
    this.meta('debug', process.env['APP_DEBUG'] === 'true')

    // Check APP_KEY is set (critical for encryption/sessions)
    const appKey = process.env['APP_KEY']
    if (!appKey || appKey.length < 10) {
      throw new Error('APP_KEY is missing or too short — run `bun mantiq key:generate`')
    }
    this.meta('key', 'set')
  }
}
