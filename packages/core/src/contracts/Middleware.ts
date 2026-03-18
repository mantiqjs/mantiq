import type { MantiqRequest } from './Request.ts'

export type NextFunction = () => Promise<Response>

export interface Middleware {
  /**
   * Handle an incoming request.
   * Call next() to pass to the next middleware or route handler.
   * Return a Response without calling next() to short-circuit.
   */
  handle(request: MantiqRequest, next: NextFunction): Promise<Response>

  /**
   * Optional: runs after the response is sent to the client.
   * Useful for logging, cleanup, analytics.
   */
  terminate?(request: MantiqRequest, response: Response): Promise<void>

  /**
   * Optional: set parameters parsed from the middleware alias string (e.g., 'throttle:60,1').
   */
  setParameters?(params: string[]): void
}
