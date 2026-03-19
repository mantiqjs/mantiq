import { Command } from '@mantiq/cli'
import type { ParsedArgs } from '@mantiq/cli'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

/**
 * Publishes the Heartbeat config and service provider into the app.
 *
 * Usage:
 *   bun run mantiq.ts heartbeat:install
 *
 * Published files:
 *   config/heartbeat.ts          — Heartbeat configuration
 *   app/Providers/HeartbeatServiceProvider.ts — App-level provider (extends package provider)
 */
export class InstallCommand extends Command {
  override name = 'heartbeat:install'
  override description = 'Install the Heartbeat observability package'

  override async handle(_args: ParsedArgs): Promise<number> {
    this.io.heading('Installing Heartbeat')
    this.io.newLine()

    const basePath = process.cwd()
    let published = 0

    // 1. Publish config
    published += await this.publishFile(
      `${basePath}/config/heartbeat.ts`,
      CONFIG_STUB,
      'config/heartbeat.ts',
    )

    // 2. Publish service provider
    published += await this.publishFile(
      `${basePath}/app/Providers/HeartbeatServiceProvider.ts`,
      PROVIDER_STUB,
      'app/Providers/HeartbeatServiceProvider.ts',
    )

    this.io.newLine()

    if (published > 0) {
      this.io.success(`Published ${published} file(s).`)
    } else {
      this.io.info('All files already exist. No changes made.')
    }

    this.io.newLine()
    this.io.info('Next steps:')
    this.io.twoColumn('  1.', 'Register the provider in your app bootstrap:')
    this.io.newLine()
    this.io.line("     import { HeartbeatServiceProvider } from './app/Providers/HeartbeatServiceProvider.ts'")
    this.io.newLine()
    this.io.line("     await app.registerProviders([..., HeartbeatServiceProvider])")
    this.io.newLine()
    this.io.twoColumn('  2.', `Visit ${this.io.cyan('/_heartbeat')} to view the dashboard.`)
    this.io.newLine()

    return 0
  }

  private async publishFile(filePath: string, content: string, displayPath: string): Promise<number> {
    if (existsSync(filePath)) {
      this.io.warn(`${displayPath} already exists, skipping.`)
      return 0
    }

    mkdirSync(dirname(filePath), { recursive: true })
    await Bun.write(filePath, content)
    this.io.success(`Published ${displayPath}`)
    return 1
  }
}

// ── Stubs ──────────────────────────────────────────────────────────────────────

const CONFIG_STUB = `import { env } from '@mantiq/core'

export default {
  /**
   * Master switch — set to false to completely disable Heartbeat.
   */
  enabled: env('HEARTBEAT_ENABLED', true),

  /**
   * Storage settings.
   *
   * connection: The database connection to use. Leave undefined to use the
   *             app's default connection. Set a string to use a dedicated one.
   * retention:  How long to keep entries (seconds). Default 24h.
   * pruneInterval: How often to prune old entries (seconds). Default 5 min.
   */
  storage: {
    connection: undefined,
    retention: 86_400,
    pruneInterval: 300,
  },

  /**
   * Queue settings for non-blocking telemetry writes.
   *
   * In development (sync driver), jobs execute immediately.
   * In production, use an async driver so telemetry doesn't block requests.
   */
  queue: {
    connection: 'sync',
    queue: 'heartbeat',
    batchSize: 50,
    flushInterval: 1_000,
  },

  /**
   * Toggle individual watchers and configure their behaviour.
   */
  watchers: {
    request:   { enabled: true, slow_threshold: 1_000, ignore: [] },
    query:     { enabled: true, slow_threshold: 100, detect_n_plus_one: true },
    exception: { enabled: true, ignore: [] },
    cache:     { enabled: true },
    job:       { enabled: true },
    event:     { enabled: true, ignore: [] },
    model:     { enabled: true },
    log:       { enabled: true, level: 'debug' },
    schedule:  { enabled: true },
  },

  /**
   * Distributed tracing via AsyncLocalStorage.
   */
  tracing: { enabled: true, propagate: true },

  /**
   * Sampling — reduce volume in high-traffic production environments.
   * rate: 1.0 = record everything, 0.1 = record 10% of requests.
   */
  sampling: { rate: 1.0, always_sample_errors: true },

  /**
   * Dashboard settings.
   *
   * path: The URL prefix where the dashboard is served.
   * enabled: Set to false to disable the dashboard entirely.
   */
  dashboard: {
    path: '/_heartbeat',
    middleware: [],
    enabled: true,
  },
}
`

const PROVIDER_STUB = `import { HeartbeatServiceProvider as BaseProvider } from '@mantiq/heartbeat'

/**
 * App-level Heartbeat service provider.
 *
 * Extend the base provider to customise authorisation, add custom watchers,
 * or hook into Heartbeat lifecycle events.
 */
export class HeartbeatServiceProvider extends BaseProvider {
  //
}
`
