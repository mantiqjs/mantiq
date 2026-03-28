import type { Middleware, NextFunction } from '../contracts/Middleware.ts'
import type { MantiqRequest } from '../contracts/Request.ts'

/**
 * Middleware that resolves route parameters to model instances.
 *
 * Register bindings before adding to the middleware stack:
 *
 * @example
 *   const binding = new RouteModelBinding()
 *   binding.bind('user', User)           // looks up User.where('id', value).first()
 *   binding.bind('post', Post, 'slug')   // looks up Post.where('slug', value).first()
 *
 *   kernel.registerMiddleware('bindings', RouteModelBinding)
 */
export class RouteModelBinding implements Middleware {
  private bindings = new Map<string, { model: any; key: string }>()

  bind(param: string, model: any, key = 'id'): void {
    this.bindings.set(param, { model, key })
  }

  async handle(request: MantiqRequest, next: NextFunction): Promise<Response> {
    const params = request.params()

    for (const [param, { model, key }] of this.bindings) {
      const value = params[param]
      if (value === undefined) continue

      const instance = await model.where(key, value).first()
      if (!instance) {
        return new Response(
          JSON.stringify({ error: `${param} not found.` }),
          { status: 404, headers: { 'Content-Type': 'application/json' } },
        )
      }

      request.setRouteParam(param, instance)
    }

    return next()
  }
}
