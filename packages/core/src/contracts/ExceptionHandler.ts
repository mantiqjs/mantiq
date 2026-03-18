import type { Constructor } from './Container.ts'
import type { MantiqRequest } from './Request.ts'

export interface ExceptionHandler {
  /**
   * Report the exception (log it, send to error tracker, etc.).
   * Called for every exception unless it's in the dontReport list.
   */
  report(error: Error): Promise<void>

  /**
   * Render the exception as an HTTP response.
   */
  render(request: MantiqRequest, error: unknown): Response

  /**
   * Exception classes that should not be reported (e.g., 404s).
   */
  dontReport: Constructor<Error>[]
}
