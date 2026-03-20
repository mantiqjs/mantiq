import type { Container, Constructor } from '../contracts/Container.ts'
import type { ExceptionHandler } from '../contracts/ExceptionHandler.ts'
import type { Middleware } from '../contracts/Middleware.ts'
import type { Router, RouteMatch } from '../contracts/Router.ts'
import { MantiqRequest } from './Request.ts'
import { MantiqResponse } from './Response.ts'
import { Pipeline } from '../middleware/Pipeline.ts'
import { WebSocketKernel } from '../websocket/WebSocketKernel.ts'
import { ConfigRepository } from '../config/ConfigRepository.ts'

export class HttpKernel {
  /**
   * Global middleware applied to every request, in order.
   * Override in a subclass (or set via kernel.setGlobalMiddleware) to customise.
   */
  protected globalMiddleware: string[] = []

  /**
   * Named middleware groups (e.g., 'web', 'api').
   * Route groups can reference these by name.
   */
  protected middlewareGroups: Record<string, string[]> = {
    web: [],
    api: [],
  }

  /**
   * Resolved middleware alias → class map.
   * Populated by the middleware registration helper below.
   */
  private middlewareAliases: Record<string, Constructor<Middleware>> = {}

  constructor(
    private readonly container: Container,
    private readonly router: Router,
    private readonly exceptionHandler: ExceptionHandler,
    private readonly wsKernel: WebSocketKernel,
  ) {}

  // ── Middleware registration ───────────────────────────────────────────────

  /**
   * Register a middleware alias so routes can reference it by name.
   * @example kernel.registerMiddleware('auth', AuthenticateMiddleware)
   */
  registerMiddleware(alias: string, middleware: Constructor<Middleware>): void {
    this.middlewareAliases[alias] = middleware
  }

  registerMiddlewareGroup(name: string, middleware: string[]): void {
    this.middlewareGroups[name] = middleware
  }

  setGlobalMiddleware(middleware: string[]): void {
    this.globalMiddleware = middleware
  }

  /**
   * Middleware registered by packages that run before the app's global middleware.
   * Separate from globalMiddleware so setGlobalMiddleware() doesn't overwrite them.
   */
  private prependMiddleware: string[] = []
  private appendMiddleware: string[] = []

  /**
   * Prepend middleware aliases that run before the app's global middleware.
   * Useful for packages that need to inject middleware without touching the app's config.
   */
  prependGlobalMiddleware(...aliases: string[]): void {
    for (const alias of aliases) {
      if (!this.prependMiddleware.includes(alias)) {
        this.prependMiddleware.push(alias)
      }
    }
  }

  /**
   * Append middleware aliases that run after the app's global middleware.
   */
  appendGlobalMiddleware(...aliases: string[]): void {
    for (const alias of aliases) {
      if (!this.appendMiddleware.includes(alias)) {
        this.appendMiddleware.push(alias)
      }
    }
  }

  // ── Request handling ─────────────────────────────────────────────────────

  /**
   * Main entry point. Passed to Bun.serve() as the fetch handler.
   */
  async handle(bunRequest: Request, server: Server): Promise<Response> {
    // WebSocket upgrade
    if (bunRequest.headers.get('upgrade')?.toLowerCase() === 'websocket') {
      return this.wsKernel.handleUpgrade(bunRequest, server)
    }

    const request = MantiqRequest.fromBun(bunRequest)

    try {
      // Combine prepend + global + append middleware
      const allMiddleware = [...this.prependMiddleware, ...this.globalMiddleware, ...this.appendMiddleware]
      const globalClasses = this.resolveMiddlewareList(allMiddleware)

      const response = await new Pipeline(this.container)
        .send(request)
        .through(globalClasses)
        .then(async (req) => {
          // Match route
          const match = this.router.resolve(req)

          // Merge route params onto request
          req.setRouteParams(match.params)

          // Resolve route-level middleware
          const routeClasses = this.resolveMiddlewareList(match.middleware)

          return new Pipeline(this.container)
            .send(req)
            .through(routeClasses)
            .then((req) => this.callAction(match, req))
        })

      return this.prepareResponse(response)
    } catch (err) {
      return this.exceptionHandler.render(request, err)
    }
  }

  /**
   * Start the Bun HTTP server.
   */
  async start(): Promise<void> {
    const config = this.container.make(ConfigRepository)
    const preferredPort = config.get<number>('app.port', 3000)
    const hostname = config.get<string>('app.host', '0.0.0.0')

    let port = preferredPort
    const maxAttempts = 20

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        Bun.serve({
          port,
          hostname,
          fetch: (req, server) => this.handle(req, server),
          websocket: this.wsKernel.getBunHandlers(),
        })

        const display = hostname === '0.0.0.0' ? 'localhost' : hostname
        if (port !== preferredPort) {
          console.log(`Port ${preferredPort} in use, using ${port} instead`)
        }
        console.log(`Server running at http://${display}:${port}`)
        return
      } catch (err: any) {
        if (err?.code === 'EADDRINUSE') {
          port++
          continue
        }
        throw err
      }
    }

    throw new Error(`No available port found (tried ${preferredPort}–${port - 1})`)
  }

  // ── Private ───────────────────────────────────────────────────────────────

  /**
   * Call the route action (controller method or closure).
   * Converts the return value to a Response.
   */
  private async callAction(match: RouteMatch, request: MantiqRequest): Promise<Response> {
    const action = match.action

    let result: any

    if (typeof action === 'function') {
      result = await action(request)
    } else if (Array.isArray(action)) {
      const [ControllerClass, method] = action
      const controller = this.container.make(ControllerClass)
      result = await (controller as any)[method](request)
    } else {
      throw new Error(`Unresolved string action '${action}'. Controllers must be registered with router.controllers().`)
    }

    return this.prepareResponse(result)
  }

  /**
   * Convert a controller return value to a native Response.
   */
  private prepareResponse(value: any): Response {
    if (value instanceof Response) return value
    if (value === null || value === undefined) return MantiqResponse.noContent()
    if (typeof value === 'string') return MantiqResponse.html(value)
    if (typeof value === 'object' || Array.isArray(value)) return MantiqResponse.json(value)
    return MantiqResponse.html(String(value))
  }

  /**
   * Resolve a list of middleware strings (aliases + parameters) to class constructors.
   * Expands middleware groups automatically.
   */
  private resolveMiddlewareList(list: string[]): Constructor<Middleware>[] {
    const resolved: Constructor<Middleware>[] = []

    for (const entry of list) {
      // Check if it's a group name
      if (this.middlewareGroups[entry]) {
        resolved.push(...this.resolveMiddlewareList(this.middlewareGroups[entry]!))
        continue
      }

      // Parse alias:param1,param2
      const colonIdx = entry.indexOf(':')
      const alias = colonIdx === -1 ? entry : entry.slice(0, colonIdx)
      const params = colonIdx === -1 ? [] : entry.slice(colonIdx + 1).split(',')

      const MiddlewareClass = this.middlewareAliases[alias]
      if (!MiddlewareClass) {
        // Try resolving from container by string alias
        try {
          const mw = this.container.make<Constructor<Middleware>>(alias)
          if (params.length > 0) {
            resolved.push(this.wrapWithParams(mw, params))
          } else {
            resolved.push(mw)
          }
        } catch {
          console.warn(`[Mantiq] Unknown middleware alias: '${alias}'`)
        }
        continue
      }

      if (params.length > 0) {
        resolved.push(this.wrapWithParams(MiddlewareClass, params))
      } else {
        resolved.push(MiddlewareClass)
      }
    }

    return resolved
  }

  /**
   * Wrap a middleware class so setParameters() is called before handle().
   */
  private wrapWithParams(
    MiddlewareClass: Constructor<Middleware>,
    params: string[],
  ): Constructor<Middleware> {
    const container = this.container
    // @internal: Create a proxy class that injects parameters after instantiation
    return class ParameterisedMiddleware {
      private inner: Middleware
      constructor() {
        this.inner = container.make(MiddlewareClass)
        this.inner.setParameters?.(params)
      }
      handle(request: MantiqRequest, next: () => Promise<Response>) {
        return this.inner.handle(request, next)
      }
      terminate(request: MantiqRequest, response: Response) {
        return this.inner.terminate?.(request, response)
      }
    } as unknown as Constructor<Middleware>
  }
}
