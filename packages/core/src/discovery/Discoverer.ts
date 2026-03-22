import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { basename, dirname, join, relative } from 'node:path'

/**
 * Auto-discovers application classes by scanning conventional directories.
 *
 * In development: scans the filesystem and rebuilds the manifest.
 * In production: reads a cached manifest from bootstrap/manifest.json.
 *
 * Usage:
 *   const discoverer = new Discoverer(app.basePath)
 *   const manifest = await discoverer.build()  // scan + cache
 *   const manifest = discoverer.cached()        // read cache only
 */

export interface DiscoveryManifest {
  providers: string[]
  commands: string[]
  routes: string[]
  models: string[]
  policies: string[]
  middleware: string[]
  observers: string[]
  listeners: string[]
  jobs: string[]
  timestamp: number
}

const EMPTY_MANIFEST: DiscoveryManifest = {
  providers: [],
  commands: [],
  routes: [],
  models: [],
  policies: [],
  middleware: [],
  observers: [],
  listeners: [],
  jobs: [],
  timestamp: 0,
}

/** Directories to scan, relative to basePath. */
const DISCOVERY_MAP: Array<{ key: keyof DiscoveryManifest; dir: string; pattern: string }> = [
  { key: 'providers',  dir: 'app/Providers',            pattern: '*ServiceProvider.ts' },
  { key: 'commands',   dir: 'app/Console/Commands',     pattern: '*Command.ts' },
  { key: 'routes',     dir: 'routes',                   pattern: '*.ts' },
  { key: 'models',     dir: 'app/Models',               pattern: '*.ts' },
  { key: 'policies',   dir: 'app/Policies',             pattern: '*Policy.ts' },
  { key: 'middleware',  dir: 'app/Http/Middleware',      pattern: '*.ts' },
  { key: 'observers',  dir: 'app/Observers',            pattern: '*Observer.ts' },
  { key: 'listeners',  dir: 'app/Listeners',            pattern: '*Listener.ts' },
  { key: 'jobs',       dir: 'app/Jobs',                 pattern: '*.ts' },
]

export class Discoverer {
  private manifestPath: string

  constructor(private basePath: string) {
    this.manifestPath = join(basePath, 'bootstrap', 'manifest.json')
  }

  /**
   * Scan all directories and build a fresh manifest.
   * Writes to bootstrap/manifest.json for caching.
   */
  async build(): Promise<DiscoveryManifest> {
    const manifest: DiscoveryManifest = { ...EMPTY_MANIFEST, timestamp: Date.now() }

    for (const { key, dir, pattern } of DISCOVERY_MAP) {
      if (key === 'timestamp') continue
      const fullDir = join(this.basePath, dir)
      const files = await this.scanDirectory(fullDir, pattern)
      ;(manifest[key] as string[]) = files.map((f) => join(dir, f))
    }

    // Write cache
    this.writeManifest(manifest)
    return manifest
  }

  /**
   * Read the cached manifest. Returns null if no cache exists.
   */
  cached(): DiscoveryManifest | null {
    if (!existsSync(this.manifestPath)) return null
    try {
      const raw = readFileSync(this.manifestPath, 'utf-8')
      return JSON.parse(raw) as DiscoveryManifest
    } catch {
      return null
    }
  }

  /**
   * Get the manifest — cached in production, fresh in development.
   */
  async resolve(isDev = true): Promise<DiscoveryManifest> {
    if (!isDev) {
      const cached = this.cached()
      if (cached) return cached
    }
    return this.build()
  }

  /**
   * Load and instantiate all discovered service providers.
   * Returns provider instances ready for registration.
   */
  async loadProviders(manifest: DiscoveryManifest): Promise<any[]> {
    const providers: any[] = []
    for (const file of manifest.providers) {
      const fullPath = join(this.basePath, file)
      try {
        const mod = await import(fullPath)
        const ProviderClass = this.findExport(mod, (v) =>
          typeof v === 'function' && v.prototype?.register && v.prototype?.boot
        )
        if (ProviderClass) providers.push(ProviderClass)
      } catch {
        // Skip unloadable providers
      }
    }
    return providers
  }

  /**
   * Load and register all discovered route files.
   * Each route file should export a default function: (router) => void
   *
   * Routes are auto-wrapped in middleware groups by filename convention:
   * - web.ts → router.group({ middleware: ['web'] })
   * - api.ts → router.group({ middleware: ['api'], prefix: '/api' })
   * - Other files (console.ts, channels.ts) → loaded as-is
   */
  async loadRoutes(manifest: DiscoveryManifest, router: any): Promise<void> {
    const groupMap: Record<string, { prefix: string }> = {
      web: { prefix: '' },
      api: { prefix: '/api' },
    }

    for (const file of manifest.routes) {
      const fullPath = join(this.basePath, file)
      try {
        const mod = await import(fullPath)
        if (typeof mod.default !== 'function') continue

        const stem = basename(file, '.ts')
        const group = groupMap[stem]

        if (group) {
          router.group(
            { middleware: [stem], prefix: group.prefix },
            (r: any) => mod.default(r),
          )
        } else {
          mod.default(router)
        }
      } catch {
        // Skip unloadable routes
      }
    }
  }

  /**
   * Load all discovered command classes for CLI kernel.
   */
  async loadCommands(manifest: DiscoveryManifest): Promise<any[]> {
    const commands: any[] = []
    for (const file of manifest.commands) {
      const fullPath = join(this.basePath, file)
      try {
        const mod = await import(fullPath)
        for (const exported of Object.values(mod)) {
          if (typeof exported !== 'function') continue
          try {
            const instance = new (exported as any)()
            if (instance.name && typeof instance.handle === 'function') {
              commands.push(instance)
            }
          } catch {
            // Not a command
          }
        }
      } catch {
        // Skip
      }
    }
    return commands
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private async scanDirectory(dir: string, pattern: string): Promise<string[]> {
    const files: string[] = []
    try {
      const glob = new Bun.Glob(pattern)
      for await (const file of glob.scan({ cwd: dir, absolute: false })) {
        // Skip dotfiles and test files
        if (file.startsWith('.') || file.includes('.test.') || file.includes('.spec.')) continue
        files.push(file)
      }
    } catch {
      // Directory doesn't exist
    }
    return files.sort()
  }

  private writeManifest(manifest: DiscoveryManifest): void {
    const dir = dirname(this.manifestPath)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(this.manifestPath, JSON.stringify(manifest, null, 2))
  }

  private findExport(mod: any, predicate: (v: any) => boolean): any {
    for (const exported of Object.values(mod)) {
      if (predicate(exported)) return exported
    }
    return null
  }
}
