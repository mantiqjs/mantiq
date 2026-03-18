import type { Container, Constructor } from '../contracts/Container.ts'
import type { Middleware, NextFunction } from '../contracts/Middleware.ts'
import type { MantiqRequest } from '../contracts/Request.ts'

/**
 * Executes a chain of middleware around a destination handler.
 *
 * Usage:
 *   const response = await new Pipeline(container)
 *     .send(request)
 *     .through([AuthMiddleware, ThrottleMiddleware])
 *     .then(async (req) => controller.handle(req))
 */
export class Pipeline {
  private passable!: MantiqRequest
  private pipes: Constructor<Middleware>[] = []
  /** Track middleware instances for terminable cleanup */
  private resolved: Middleware[] = []

  constructor(private readonly container: Container) {}

  send(request: MantiqRequest): this {
    this.passable = request
    return this
  }

  through(middleware: Constructor<Middleware>[]): this {
    this.pipes = middleware
    return this
  }

  async then(destination: (request: MantiqRequest) => Promise<Response>): Promise<Response> {
    const pipeline = this.build(destination)
    return pipeline()
  }

  /**
   * Run terminable middleware after the response has been sent.
   * Call this after the response is returned from then().
   */
  async terminate(response: Response): Promise<void> {
    for (const middleware of this.resolved) {
      if (middleware.terminate) {
        await middleware.terminate(this.passable, response)
      }
    }
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private build(
    destination: (request: MantiqRequest) => Promise<Response>,
  ): NextFunction {
    // Build from the inside out: last middleware wraps the destination
    return this.pipes.reduceRight(
      (next: NextFunction, MiddlewareClass: Constructor<Middleware>): NextFunction => {
        return async (): Promise<Response> => {
          const middleware = this.container.make(MiddlewareClass)
          this.resolved.push(middleware)
          return middleware.handle(this.passable, next)
        }
      },
      () => destination(this.passable),
    )
  }
}
