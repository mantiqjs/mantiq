import { ContainerImpl } from '../container/Container.ts'
import { ConfigRepository } from '../config/ConfigRepository.ts'
import { ContainerResolutionError } from '../errors/ContainerResolutionError.ts'
import type { ServiceProvider } from '../contracts/ServiceProvider.ts'
import type { Bindable, Constructor } from '../contracts/Container.ts'

/**
 * The Application is the heart of MantiqJS.
 *
 * It extends the service container and owns:
 * - Config loading (always happens before any provider runs)
 * - Provider registration + boot lifecycle
 * - Deferred provider resolution
 * - The global singleton accessible via app()
 *
 * Boot sequence:
 *   const app = await Application.create('config/')
 *   await app.registerProviders([...])
 *   await app.bootProviders()
 *   await app.make(HttpKernel).start()
 */
export class Application extends ContainerImpl {
  /** The global singleton instance — set once at bootstrap. */
  private static _instance: Application | null = null

  private providers: ServiceProvider[] = []
  private deferredProviders = new Map<Bindable<any>, ServiceProvider>()
  private booted = false

  private constructor(private readonly basePath: string = process.cwd()) {
    super()
    // Register the application itself so it can be resolved from the container
    this.instance(Application as any, this)
  }

  // ── Singleton access ──────────────────────────────────────────────────────

  /**
   * Create and configure the application.
   * Loads config immediately so config() is available before any provider runs.
   *
   * @param basePath - Project root directory
   * @param configPath - Path to config directory (relative to basePath)
   */
  static async create(
    basePath: string = process.cwd(),
    configPath: string = 'config',
  ): Promise<Application> {
    const app = new Application(basePath)
    await app.loadConfig(configPath)
    Application._instance = app
    return app
  }

  /**
   * Return the global Application instance.
   * @throws Error if the application has not been created yet.
   */
  static getInstance(): Application {
    if (!Application._instance) {
      throw new Error(
        'Application has not been created. Call Application.create() first.',
      )
    }
    return Application._instance
  }

  /**
   * Set the global instance (useful for testing).
   */
  static setInstance(app: Application): void {
    Application._instance = app
  }

  /**
   * Destroy the global instance (useful for testing).
   */
  static resetInstance(): void {
    Application._instance = null
  }

  // ── Config ────────────────────────────────────────────────────────────────

  /**
   * Load config files from the given directory.
   * Config is available immediately after this call via config() and app.make(ConfigRepository).
   *
   * Falls back to a cached config file at bootstrap/cache/config.json if present.
   */
  async loadConfig(configDir: string): Promise<void> {
    const cachePath = `${this.basePath}/bootstrap/cache/config.json`
    let config: ConfigRepository

    // Check for cached config first (production optimization)
    try {
      const cacheFile = Bun.file(cachePath)
      if (await cacheFile.exists()) {
        const data = await cacheFile.json()
        config = new ConfigRepository(data)
        this.instance(ConfigRepository, config)
        return
      }
    } catch {
      // No cache — load from files
    }

    const fullConfigPath = configDir.startsWith('/')
      ? configDir
      : `${this.basePath}/${configDir}`

    config = await ConfigRepository.fromDirectory(fullConfigPath)
    this.instance(ConfigRepository, config)
  }

  /**
   * Get the config repository directly (no container lookup overhead).
   */
  config(): ConfigRepository {
    return this.make(ConfigRepository)
  }

  // ── Base path helpers ─────────────────────────────────────────────────────

  basePath_(path: string = ''): string {
    return path ? `${this.basePath}/${path}` : this.basePath
  }

  configPath(path: string = ''): string {
    return this.basePath_(path ? `config/${path}` : 'config')
  }

  storagePath(path: string = ''): string {
    return this.basePath_(path ? `storage/${path}` : 'storage')
  }

  // ── Package provider discovery ──────────────────────────────────────────

  /**
   * Discover service providers from installed @mantiq/* packages.
   * Each package declares its provider in package.json:
   *   { "mantiq": { "provider": "AuthServiceProvider" } }
   *
   * Install a package → provider auto-discovered. Uninstall → gone.
   */
  async discoverPackageProviders(): Promise<Constructor<ServiceProvider>[]> {
    const providers: Constructor<ServiceProvider>[] = []
    const nodeModulesDir = this.basePath_('node_modules/@mantiq')

    try {
      const glob = new Bun.Glob('*/package.json')
      for await (const file of glob.scan({ cwd: nodeModulesDir, absolute: false })) {
        try {
          const pkgJson = JSON.parse(
            await Bun.file(`${nodeModulesDir}/${file}`).text()
          )
          const providerName = pkgJson?.mantiq?.provider
          if (!providerName) continue

          const pkgName = pkgJson.name as string
          const mod = await import(pkgName)
          if (mod[providerName] && typeof mod[providerName] === 'function') {
            providers.push(mod[providerName])
          }
        } catch {
          // Skip packages that can't be loaded
        }
      }
    } catch {
      // node_modules/@mantiq doesn't exist
    }

    return providers
  }

  /**
   * One-call bootstrap: discover package providers, register, boot.
   * Equivalent to:
   *   const providers = await app.discoverPackageProviders()
   *   await app.registerProviders([CoreServiceProvider, ...providers, ...userProviders])
   *   await app.bootProviders()
   */
  async bootstrap(
    coreProviders: Constructor<ServiceProvider>[] = [],
    userProviders: Constructor<ServiceProvider>[] = [],
  ): Promise<void> {
    const packageProviders = await this.discoverPackageProviders()
    await this.registerProviders([...coreProviders, ...packageProviders, ...userProviders])
    await this.bootProviders()
  }

  // ── Provider lifecycle ────────────────────────────────────────────────────

  /**
   * Register all service providers.
   * - Deferred providers are indexed but not registered until their bindings are first resolved.
   * - All non-deferred register() calls complete before any boot() is called.
   */
  async registerProviders(providerClasses: Constructor<ServiceProvider>[]): Promise<void> {
    const nonDeferred: ServiceProvider[] = []

    for (const ProviderClass of providerClasses) {
      const provider = new ProviderClass(this)

      if (provider.deferred) {
        // Index by every binding this provider offers
        for (const binding of provider.provides()) {
          this.deferredProviders.set(binding, provider)
        }
      } else {
        await provider.register()
        nonDeferred.push(provider)
      }
    }

    this.providers = nonDeferred
  }

  /**
   * Boot all registered (non-deferred) providers.
   * Called after ALL providers have been registered.
   */
  async bootProviders(): Promise<void> {
    for (const provider of this.providers) {
      await provider.boot()
    }
    this.booted = true
  }

  /**
   * Register a single provider immediately (after initial boot).
   * Useful for testing and dynamic provider loading.
   */
  async register(ProviderClass: Constructor<ServiceProvider>): Promise<void> {
    const provider = new ProviderClass(this)
    await provider.register()
    if (this.booted) {
      await provider.boot()
    } else {
      this.providers.push(provider)
    }
  }

  // ── Deferred provider resolution ──────────────────────────────────────────

  /**
   * Override make() to handle deferred provider loading.
   * If a binding isn't found in the container, check deferred providers.
   */
  override make<T>(abstract: Bindable<T>): T {
    try {
      return super.make(abstract)
    } catch (err) {
      if (
        err instanceof ContainerResolutionError &&
        err.reason === 'not_bound'
      ) {
        const deferredProvider = this.deferredProviders.get(abstract)
        if (deferredProvider) {
          // Remove from deferred map so we don't loop
          for (const [key, p] of this.deferredProviders.entries()) {
            if (p === deferredProvider) this.deferredProviders.delete(key)
          }
          // Register + boot the deferred provider now
          const boot = async () => {
            await deferredProvider.register()
            await deferredProvider.boot()
            this.providers.push(deferredProvider)
          }
          // @internal: sync wrapper — deferred providers must not have async register/boot
          // that relies on other async operations. In practice this is fine.
          void boot()
          return super.make(abstract)
        }
      }
      throw err
    }
  }

  // ── Environment ───────────────────────────────────────────────────────────

  environment(): string {
    return process.env['APP_ENV'] ?? 'production'
  }

  isLocal(): boolean {
    return this.environment() === 'local'
  }

  isProduction(): boolean {
    return this.environment() === 'production'
  }

  isDebug(): boolean {
    return process.env['APP_DEBUG'] === 'true'
  }
}
