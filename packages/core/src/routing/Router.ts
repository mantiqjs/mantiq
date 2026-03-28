import type {
  HttpMethod,
  RouteAction,
  RouteDefinition,
  RouteGroupOptions,
  RouteMatch,
  Router as RouterContract,
  RouterRoute,
} from '../contracts/Router.ts'
import type { Constructor } from '../contracts/Container.ts'
import type { MantiqRequest } from '../contracts/Request.ts'
import type { EventDispatcher } from '../contracts/EventDispatcher.ts'
import { Route } from './Route.ts'
import { RouteCollection } from './RouteCollection.ts'
import { RouteMatcher } from './RouteMatcher.ts'
import { ResourceRegistrar } from './ResourceRegistrar.ts'
import { NotFoundError } from '../errors/NotFoundError.ts'
import { HttpError } from '../errors/HttpError.ts'
import { MantiqError } from '../errors/MantiqError.ts'
import { ConfigRepository } from '../config/ConfigRepository.ts'
import { RouteMatched } from './events.ts'

export class RouterImpl implements RouterContract {
  private collection = new RouteCollection()
  private registrar = new ResourceRegistrar(this)
  private modelBindings = new Map<string, Constructor<any>>()
  private customBindings = new Map<string, (value: string) => Promise<any>>()
  private controllerRegistry = new Map<string, Constructor<any>>()

  /** Optional event dispatcher. Set by @mantiq/events when installed. */
  static _dispatcher: EventDispatcher | null = null

  /** Stack of active group option frames */
  private groupStack: RouteGroupOptions[] = []

  constructor(private readonly config?: ConfigRepository) {}

  /**
   * Register controller classes for string-based route actions.
   *
   * @example
   * router.controllers({
   *   AuthController,
   *   HomeController,
   *   UserController,
   * })
   *
   * // Then in routes:
   * router.get('/login', 'AuthController@login')
   * router.get('/', 'HomeController@index')
   */
  controllers(map: Record<string, Constructor<any>>): void {
    for (const [name, ctor] of Object.entries(map)) {
      this.controllerRegistry.set(name, ctor)
    }
  }

  // ── HTTP method registration ───────────────────────────────────────────────

  get(path: string, action: RouteAction): RouterRoute {
    return this.addRoute(['GET'], path, action)
  }

  post(path: string, action: RouteAction): RouterRoute {
    return this.addRoute(['POST'], path, action)
  }

  put(path: string, action: RouteAction): RouterRoute {
    return this.addRoute(['PUT'], path, action)
  }

  patch(path: string, action: RouteAction): RouterRoute {
    return this.addRoute(['PATCH'], path, action)
  }

  delete(path: string, action: RouteAction): RouterRoute {
    return this.addRoute(['DELETE'], path, action)
  }

  options(path: string, action: RouteAction): RouterRoute {
    return this.addRoute(['OPTIONS'], path, action)
  }

  match(methods: HttpMethod[], path: string, action: RouteAction): RouterRoute {
    return this.addRoute(methods, path, action)
  }

  any(path: string, action: RouteAction): RouterRoute {
    return this.addRoute(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], path, action)
  }

  // ── Resource routes ────────────────────────────────────────────────────────

  resource(name: string, controller: Constructor<any>): void {
    this.registrar.register(name, controller, false)
  }

  apiResource(name: string, controller: Constructor<any>): void {
    this.registrar.register(name, controller, true)
  }

  // ── Groups ────────────────────────────────────────────────────────────────

  group(options: RouteGroupOptions, callback: (router: RouterContract) => void): void {
    this.groupStack.push(options)
    callback(this)
    this.groupStack.pop()
  }

  // ── URL generation ─────────────────────────────────────────────────────────

  url(name: string, params: Record<string, any> = {}, absolute = false): string {
    const route = this.collection.getByName(name)
    if (!route) {
      throw new MantiqError(`Route '${name}' not found.`)
    }

    let path = route.path
    const usedParams = new Set<string>()

    // Replace :param segments
    path = path.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)(\?)?/g, (_, paramName: string, optional: string) => {
      if (params[paramName] !== undefined) {
        usedParams.add(paramName)
        return encodeURIComponent(String(params[paramName]))
      }
      if (optional) return ''
      throw new MantiqError(
        `Missing required parameter '${paramName}' for route '${name}'.`,
      )
    })

    // Append remaining params as query string
    const remaining = Object.entries(params)
      .filter(([k]) => !usedParams.has(k))
    if (remaining.length > 0) {
      path += '?' + new URLSearchParams(
        Object.fromEntries(remaining.map(([k, v]) => [k, String(v)])),
      ).toString()
    }

    if (absolute) {
      const base = this.config?.get('app.url', 'http://localhost:3000') ?? 'http://localhost:3000'
      return `${base}${path}`
    }

    return path
  }

  // ── Route matching ─────────────────────────────────────────────────────────

  resolve(request: MantiqRequest): RouteMatch {
    const method = request.method() as HttpMethod
    const pathname = request.path()

    // Try to match against routes for this method
    const candidates = this.collection.getByMethod(method)

    for (const route of candidates) {
      const result = RouteMatcher.match(route, pathname)
      if (result) {
        RouterImpl._dispatcher?.emit(new RouteMatched(route.routeName, route.action, request))

        // Merge route-level bindings with router-level bindings (route-level takes precedence)
        const bindings = new Map<string, { model: any; key: string }>()

        // Add router-level model bindings (model class → where('id', value).first())
        for (const [param, ModelClass] of this.modelBindings) {
          if (result.params[param] !== undefined) {
            bindings.set(param, { model: ModelClass, key: 'id' })
          }
        }

        // Add router-level custom bindings (resolver function)
        for (const [param, resolver] of this.customBindings) {
          if (result.params[param] !== undefined) {
            bindings.set(param, { model: resolver, key: '__custom__' })
          }
        }

        // Route-level bindings override router-level
        for (const [param, binding] of route.bindings) {
          if (result.params[param] !== undefined) {
            bindings.set(param, binding)
          }
        }

        const match: RouteMatch = {
          action: route.action,
          params: result.params,
          middleware: route.middlewareList,
          routeName: route.routeName,
        }

        if (bindings.size > 0) {
          match.bindings = bindings
        }

        return match
      }
    }

    // Check if path exists under a different method → 405
    const allMethods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
    const allowedMethods: HttpMethod[] = []

    for (const m of allMethods) {
      if (m === method) continue
      const others = this.collection.getByMethod(m)
      for (const route of others) {
        if (RouteMatcher.match(route, pathname)) {
          allowedMethods.push(m)
          break
        }
      }
    }

    if (allowedMethods.length > 0) {
      throw new HttpError(405, 'Method Not Allowed', {
        Allow: allowedMethods.join(', '),
      })
    }

    throw new NotFoundError(`No route found for ${method} ${pathname}`)
  }

  routes(): RouteDefinition[] {
    return this.collection.all().map((r) => ({
      method: r.methods.length === 1 ? r.methods[0]! : r.methods,
      path: r.path,
      action: r.action,
      name: r.routeName,
      middleware: r.middlewareList,
      wheres: r.wheres,
    }))
  }

  // ── Model bindings ─────────────────────────────────────────────────────────

  model(param: string, model: Constructor<any>): void {
    this.modelBindings.set(param, model)
  }

  bind(param: string, resolver: (value: string) => Promise<any>): void {
    this.customBindings.set(param, resolver)
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private addRoute(methods: HttpMethod[], path: string, action: RouteAction): Route {
    const mergedPath = this.mergePath(path)
    const resolvedAction = this.resolveAction(action)
    const route = new Route(methods, mergedPath, resolvedAction)

    // Apply group middleware
    const groupMiddleware = this.groupStack.flatMap((g) => g.middleware ?? [])
    if (groupMiddleware.length > 0) route.middleware(...groupMiddleware)

    // Always wrap name() so the collection's name index is updated when .name() is called
    // after add() (which is the normal usage: router.get(...).name('foo'))
    const namePrefix = this.groupStack.map((g) => g.as ?? '').join('')
    const originalName = route.name.bind(route)
    route.name = (n: string) => {
      originalName(namePrefix + n)
      this.collection.indexName(route)
      return route
    }

    this.collection.add(route)
    return route
  }

  /**
   * Resolve a string action like 'AuthController@login' to [Constructor, method].
   */
  private resolveAction(action: RouteAction): Exclude<RouteAction, string> {
    if (typeof action !== 'string') return action

    const [controllerName, method] = action.split('@')
    if (!controllerName || !method) {
      throw new MantiqError(
        `Invalid route action string '${action}'. Expected format: 'ControllerName@method'.`,
      )
    }

    // Check namespace prefix from group stack
    const namespace = this.groupStack
      .map((g) => g.namespace ?? '')
      .filter(Boolean)
      .join('/')

    const fullName = namespace ? `${namespace}/${controllerName}` : controllerName
    const Controller = this.controllerRegistry.get(fullName)
      ?? this.controllerRegistry.get(controllerName)

    if (!Controller) {
      throw new MantiqError(
        `Controller '${controllerName}' not found. Register it with router.controllers({ ${controllerName} }).`,
      )
    }

    return [Controller, method]
  }

  private mergePath(path: string): string {
    const prefixes = this.groupStack.map((g) => g.prefix ?? '').filter(Boolean)
    if (prefixes.length === 0) return path
    const prefix = prefixes.join('')
    return prefix + (path.startsWith('/') ? path : `/${path}`)
  }
}
