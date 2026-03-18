import type { Route } from './Route.ts'

export interface MatchResult {
  route: Route
  params: Record<string, any>
}

/**
 * Matches a URL path against a route pattern.
 *
 * Supported syntax:
 * - Static segments: /users/profile
 * - Required params: /users/:id
 * - Optional params: /posts/:slug?
 * - Wildcard (end only): /files/*
 */
export class RouteMatcher {
  static match(route: Route, pathname: string): MatchResult | null {
    const params: Record<string, any> = {}
    const routeSegments = route.path.split('/').filter(Boolean)
    const pathSegments = pathname.split('/').filter(Boolean)

    let routeIdx = 0
    let pathIdx = 0

    while (routeIdx < routeSegments.length) {
      const seg = routeSegments[routeIdx]!

      // Wildcard — matches the rest
      if (seg === '*') {
        params['*'] = pathSegments.slice(pathIdx).join('/')
        return this.checkConstraints(route, params) ? { route, params } : null
      }

      // Optional param
      if (seg.startsWith(':') && seg.endsWith('?')) {
        const name = seg.slice(1, -1)
        if (pathIdx < pathSegments.length) {
          params[name] = pathSegments[pathIdx]
          pathIdx++
        } else {
          params[name] = undefined
        }
        routeIdx++
        continue
      }

      // Required param
      if (seg.startsWith(':')) {
        const name = seg.slice(1)
        if (pathIdx >= pathSegments.length) return null
        params[name] = pathSegments[pathIdx]
        pathIdx++
        routeIdx++
        continue
      }

      // Static segment
      if (pathIdx >= pathSegments.length || pathSegments[pathIdx] !== seg) {
        return null
      }

      pathIdx++
      routeIdx++
    }

    // All route segments consumed — path must also be fully consumed
    if (pathIdx !== pathSegments.length) return null

    // Check constraints
    if (!this.checkConstraints(route, params)) return null

    // Coerce numeric params
    for (const [key, regex] of Object.entries(route.wheres)) {
      if (regex.source === '^\\d+$' && params[key] !== undefined) {
        params[key] = Number(params[key])
      }
    }

    return { route, params }
  }

  private static checkConstraints(route: Route, params: Record<string, any>): boolean {
    for (const [param, pattern] of Object.entries(route.wheres)) {
      const value = params[param]
      if (value !== undefined && !pattern.test(String(value))) {
        return false
      }
    }
    return true
  }
}
