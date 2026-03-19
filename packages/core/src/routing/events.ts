import { Event } from '../contracts/EventDispatcher.ts'
import type { RouteAction } from '../contracts/Router.ts'
import type { MantiqRequest } from '../contracts/Request.ts'

/**
 * Fired when the router successfully matches a request to a route.
 */
export class RouteMatched extends Event {
  constructor(
    /** The matched route name (if named). */
    public readonly routeName: string | undefined,
    /** The matched route action. */
    public readonly action: RouteAction,
    /** The request that was matched. */
    public readonly request: MantiqRequest,
  ) {
    super()
  }
}
