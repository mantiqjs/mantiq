import { ServiceProvider, ConfigRepository, RouterImpl, HttpKernel, CacheManager } from '@mantiq/core'
import type { EventDispatcher } from '@mantiq/core'
import { DatabaseManager, SQLiteConnection } from '@mantiq/database'
import type { HeartbeatConfig } from './contracts/HeartbeatConfig.ts'
import { DEFAULT_CONFIG } from './contracts/HeartbeatConfig.ts'
import { Heartbeat } from './Heartbeat.ts'
import { HEARTBEAT, setHeartbeat } from './helpers/heartbeat.ts'
import { Tracer } from './tracing/Tracer.ts'
import { MetricsCollector } from './metrics/MetricsCollector.ts'
import { RequestMetrics } from './metrics/RequestMetrics.ts'
import { QueueMetrics } from './metrics/QueueMetrics.ts'
import { SystemMetrics } from './metrics/SystemMetrics.ts'
import { RequestWatcher } from './watchers/RequestWatcher.ts'
import { QueryWatcher } from './watchers/QueryWatcher.ts'
import { ExceptionWatcher } from './watchers/ExceptionWatcher.ts'
import { CacheWatcher } from './watchers/CacheWatcher.ts'
import { JobWatcher } from './watchers/JobWatcher.ts'
import { EventWatcher } from './watchers/EventWatcher.ts'
import { ModelWatcher } from './watchers/ModelWatcher.ts'
import { LogWatcher } from './watchers/LogWatcher.ts'
import { MailWatcher } from './watchers/MailWatcher.ts'
import { ScheduleWatcher } from './watchers/ScheduleWatcher.ts'
import { CreateHeartbeatTables } from './migrations/CreateHeartbeatTables.ts'
import { DashboardController } from './dashboard/DashboardController.ts'
import { HeartbeatMiddleware } from './middleware/HeartbeatMiddleware.ts'
import type { Watcher } from './contracts/Watcher.ts'
import { SimpleEventBus } from './helpers/SimpleEventBus.ts'

export class HeartbeatServiceProvider extends ServiceProvider {
  override register(): void {
    this.app.singleton(Heartbeat, (c) => {
      const config = c.make(ConfigRepository).get<HeartbeatConfig>('heartbeat', DEFAULT_CONFIG)

      // Resolve connection — undefined means use app's default database connection
      const dbManager = c.make(DatabaseManager)
      const connection = dbManager.connection(config.storage.connection)

      const heartbeat = new Heartbeat(config, connection)
      setHeartbeat(heartbeat)
      return heartbeat
    })

    this.app.alias(Heartbeat, HEARTBEAT)

    // Singletons for tracing and metrics
    this.app.singleton(Tracer, () => new Tracer())
    this.app.singleton(MetricsCollector, () => new MetricsCollector())
  }

  override async boot(): Promise<void> {
    let heartbeat: Heartbeat
    try {
      heartbeat = this.app.make(Heartbeat)
    } catch (e) {
      console.warn('[Mantiq] HeartbeatServiceProvider skipped — database not configured. Run `bun mantiq migrate` to set up.')
      return
    }
    const config = heartbeat.config

    if (!config.enabled) return

    // Run heartbeat migration to ensure tables exist
    const migration = new CreateHeartbeatTables()
    const connection = heartbeat.store.getConnection()
    await migration.up(connection.schema(), connection)

    // Set up tracer
    const tracer = this.app.make(Tracer)
    tracer.setStore(heartbeat.store)
    heartbeat.setTracer(tracer)

    // Set up metrics
    const metrics = this.app.make(MetricsCollector)
    metrics.setStore(heartbeat.store)

    this.app.instance(RequestMetrics, new RequestMetrics(metrics))
    this.app.instance(QueueMetrics, new QueueMetrics(metrics))
    this.app.instance(SystemMetrics, new SystemMetrics(metrics))

    // Set up event bus for watcher event listeners
    const eventBus = this.setupEventBus()

    // Register watchers
    const requestWatcher = this.registerWatchers(heartbeat, config, eventBus)

    // Start periodic systems
    metrics.start()
    heartbeat.startPruning()

    const systemMetrics = this.app.make(SystemMetrics)
    systemMetrics.start()

    // Register HeartbeatMiddleware as first global middleware
    this.registerMiddleware(heartbeat, tracer, requestWatcher, metrics)

    // Register dashboard routes
    if (config.dashboard.enabled) {
      this.registerDashboardRoutes(heartbeat, metrics, config)
    }
  }

  private registerMiddleware(
    heartbeat: Heartbeat,
    tracer: Tracer,
    requestWatcher: RequestWatcher | null,
    metrics: MetricsCollector,
  ): void {
    const kernel = this.app.make(HttpKernel)

    // Register the middleware instance in the container
    const middleware = new HeartbeatMiddleware(heartbeat, tracer, requestWatcher, metrics)
    this.app.instance(HeartbeatMiddleware, middleware)

    // Register alias and prepend to global middleware
    kernel.registerMiddleware('heartbeat', HeartbeatMiddleware)
    kernel.prependGlobalMiddleware('heartbeat')
  }

  private registerDashboardRoutes(heartbeat: Heartbeat, metrics: MetricsCollector, config: HeartbeatConfig): void {
    const router = this.app.make(RouterImpl)
    const basePath = config.dashboard.path
    const env = this.app.make(ConfigRepository).get<string>('app.env', 'production')
    const controller = new DashboardController(heartbeat.store, metrics, basePath)

    // Register catch-all route for the dashboard
    // The DashboardController handles sub-routing internally
    router.any(`${basePath}`, (request) => {
      return this.gateDashboard(env, request, controller)
    })

    router.any(`${basePath}/*`, (request) => {
      return this.gateDashboard(env, request, controller)
    })
  }

  private async gateDashboard(env: string, request: any, controller: DashboardController): Promise<Response> {
    // Gate: allow in development/local/testing, block in production
    if (env !== 'development' && env !== 'local' && env !== 'testing') {
      return new Response('Forbidden — Heartbeat dashboard is disabled in production.', {
        status: 403,
        headers: { 'Content-Type': 'text/plain' },
      })
    }

    return controller.handle(request.raw())
  }

  /**
   * Set up an event bus for watchers.
   *
   * If @mantiq/events Dispatcher is already in the container, reuse it.
   * Otherwise, create a SimpleEventBus and hook it into SQLiteConnection,
   * CacheManager, and RouterImpl so events flow even without the events package.
   */
  private setupEventBus(): SimpleEventBus {
    // Check if a full dispatcher already exists
    const existingDispatcher = SQLiteConnection._dispatcher
    if (existingDispatcher && typeof (existingDispatcher as any).on === 'function') {
      // Wrap the existing dispatcher's on/onAny into our SimpleEventBus
      // so watchers register on the same dispatcher that fires events
      const bus = new SimpleEventBus()
      // Proxy: listeners registered on our bus also get registered on the real dispatcher
      const realOn = (existingDispatcher as any).on.bind(existingDispatcher)
      const realOnAny = (existingDispatcher as any).onAny?.bind(existingDispatcher)
      const origOn = bus.on.bind(bus)
      const origOnAny = bus.onAny.bind(bus)
      bus.on = (eventClass: any, handler: any) => { origOn(eventClass, handler); realOn(eventClass, handler) }
      if (realOnAny) {
        bus.onAny = (handler: any) => { origOnAny(handler); realOnAny(handler) }
      }
      return bus
    }

    // No existing dispatcher — create our own and hook it into framework statics
    const bus = new SimpleEventBus()
    SQLiteConnection._dispatcher = bus as any
    CacheManager._dispatcher = bus as any
    RouterImpl._dispatcher = bus as any
    return bus
  }

  /**
   * Register watchers and return the RequestWatcher instance (if enabled).
   */
  private registerWatchers(heartbeat: Heartbeat, config: HeartbeatConfig, eventBus: SimpleEventBus): RequestWatcher | null {
    let requestWatcher: RequestWatcher | null = null

    const watcherMap: Array<[keyof HeartbeatConfig['watchers'], Watcher]> = [
      ['request', new RequestWatcher()],
      ['query', new QueryWatcher()],
      ['exception', new ExceptionWatcher()],
      ['cache', new CacheWatcher()],
      ['job', new JobWatcher()],
      ['event', new EventWatcher()],
      ['model', new ModelWatcher()],
      ['log', new LogWatcher()],
      ['mail', new MailWatcher()],
      ['schedule', new ScheduleWatcher()],
    ]

    const on = eventBus.on.bind(eventBus)
    const onAny = eventBus.onAny.bind(eventBus)

    for (const [key, watcher] of watcherMap) {
      const watcherConfig = config.watchers[key as keyof typeof config.watchers]
      if (!watcherConfig?.enabled) continue

      watcher.configure(watcherConfig as Record<string, any>)
      heartbeat.addWatcher(watcher)
      watcher.register(on, onAny)

      if (key === 'request') {
        requestWatcher = watcher as RequestWatcher
      }
    }

    return requestWatcher
  }
}
