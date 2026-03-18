import type { Middleware, NextFunction } from '../contracts/Middleware.ts'
import type { MantiqRequest } from '../contracts/Request.ts'

/**
 * Trims whitespace from all string input values.
 * Applied globally in the web middleware group.
 */
export class TrimStringsMiddleware implements Middleware {
  /** Input keys to skip (e.g., passwords). */
  protected except: string[] = ['password', 'password_confirmation', 'current_password']

  async handle(request: MantiqRequest, next: NextFunction): Promise<Response> {
    // @internal: Trimming happens lazily when input() is accessed.
    // We wrap the request's input by patching parsedBody after first access.
    // Since MantiqRequest.input() is async and parses lazily, we can intercept
    // by using a Proxy or post-parse hook. For simplicity we pre-parse here.
    try {
      const body = await (request as any).parseBodyForTrimming?.()
      if (body && typeof body === 'object') {
        for (const key of Object.keys(body)) {
          if (!this.except.includes(key) && typeof body[key] === 'string') {
            body[key] = (body[key] as string).trim()
          }
        }
      }
    } catch {
      // Ignore parse errors — next middleware will handle them
    }

    return next()
  }
}
