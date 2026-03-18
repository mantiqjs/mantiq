import type { HttpMethod } from '../contracts/Router.ts'
import { Route } from './Route.ts'

/**
 * Stores all registered routes, indexed by HTTP method for fast lookup.
 */
export class RouteCollection {
  private routes = new Map<HttpMethod, Route[]>()
  private namedRoutes = new Map<string, Route>()

  add(route: Route): void {
    const methods = Array.isArray(route.methods) ? route.methods : [route.methods]
    for (const method of methods) {
      if (!this.routes.has(method)) this.routes.set(method, [])
      this.routes.get(method)!.push(route)
    }
    if (route.routeName) {
      this.namedRoutes.set(route.routeName, route)
    }
  }

  getByMethod(method: HttpMethod): Route[] {
    return this.routes.get(method) ?? []
  }

  getByName(name: string): Route | undefined {
    return this.namedRoutes.get(name)
  }

  /** Update named route index when a name is set after route registration. */
  indexName(route: Route): void {
    if (route.routeName) {
      this.namedRoutes.set(route.routeName, route)
    }
  }

  all(): Route[] {
    const seen = new Set<Route>()
    const result: Route[] = []
    for (const routes of this.routes.values()) {
      for (const route of routes) {
        if (!seen.has(route)) {
          seen.add(route)
          result.push(route)
        }
      }
    }
    return result
  }
}
