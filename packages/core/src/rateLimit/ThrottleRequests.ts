import type { MantiqRequest } from '../contracts/Request.ts'
import { HttpError } from '../errors/HttpError.ts'
import { RateLimiter } from './RateLimiter.ts'
import type { RateLimitConfig } from './RateLimiter.ts'

/** Shared default RateLimiter instance. */
let _defaultLimiter: RateLimiter | null = null
export function getDefaultRateLimiter(): RateLimiter {
  if (!_defaultLimiter) _defaultLimiter = new RateLimiter()
  return _defaultLimiter
}
export function setDefaultRateLimiter(limiter: RateLimiter): void {
  _defaultLimiter = limiter
}

/**
 * Middleware that throttles requests using the RateLimiter.
 *
 * Usage with named limiter:
 *   router.get('/api/data', handler).middleware('throttle:api')
 *
 * Usage with inline limits:
 *   router.get('/api/data', handler).middleware('throttle:60,1')
 *   // 60 requests per 1 minute, keyed by IP
 *
 * Response headers:
 *   X-RateLimit-Limit: 60
 *   X-RateLimit-Remaining: 45
 *   Retry-After: 30 (only when rate limited)
 */
export class ThrottleRequests {
  private params: string[] = []
  private rateLimiter: RateLimiter = getDefaultRateLimiter()

  constructor() {}

  /** Use a custom RateLimiter instead of the default shared instance. */
  useRateLimiter(limiter: RateLimiter): this {
    this.rateLimiter = limiter
    return this
  }

  setParameters(...params: string[]): void {
    this.params = params
  }

  async handle(request: MantiqRequest, next: () => Promise<Response>): Promise<Response> {
    const configs = this.resolveConfigs(request)

    // Check all limits before proceeding
    for (const config of configs) {
      const fullKey = `rate_limit:${config.key}`

      if (await this.rateLimiter.tooManyAttempts(fullKey, config.maxAttempts)) {
        const retryAfter = await this.rateLimiter.availableIn(fullKey)
        return this.buildTooManyResponse(request, config, retryAfter)
      }
    }

    // Record hits
    for (const config of configs) {
      const fullKey = `rate_limit:${config.key}`
      await this.rateLimiter.hit(fullKey, config.decayMinutes * 60)
    }

    // Process request
    const response = await next()

    // Add rate limit headers (use the most restrictive limit)
    return this.addHeaders(response, configs)
  }

  private resolveConfigs(request: MantiqRequest): RateLimitConfig[] {
    if (this.params.length === 0) {
      // Default: 60 per minute by IP
      return [{ key: request.ip(), maxAttempts: 60, decayMinutes: 1 }]
    }

    const first = this.params[0]!

    // Check if it's a named limiter
    const resolver = this.rateLimiter.limiter(first)
    if (resolver) {
      const result = resolver(request)
      return Array.isArray(result) ? result : [result]
    }

    // Inline: throttle:maxAttempts,decayMinutes
    const maxAttempts = parseInt(first, 10) || 60
    const decayMinutes = parseInt(this.params[1] ?? '1', 10) || 1

    return [{
      key: request.ip(),
      maxAttempts,
      decayMinutes,
    }]
  }

  private buildTooManyResponse(
    request: MantiqRequest,
    config: RateLimitConfig,
    retryAfter: number,
  ): Response {
    if (config.responseCallback) {
      const headers: Record<string, string> = {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(config.maxAttempts),
        'X-RateLimit-Remaining': '0',
      }
      const custom = config.responseCallback(request, headers)
      if (custom) return custom
    }

    const body = request.expectsJson()
      ? JSON.stringify({ message: 'Too Many Requests', retry_after: retryAfter })
      : 'Too Many Requests'

    return new Response(body, {
      status: 429,
      headers: {
        'Content-Type': request.expectsJson() ? 'application/json' : 'text/plain',
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(config.maxAttempts),
        'X-RateLimit-Remaining': '0',
      },
    })
  }

  private async addHeaders(response: Response, configs: RateLimitConfig[]): Promise<Response> {
    // Use the most restrictive limit for headers
    let minRemaining = Infinity
    let limit = 0

    for (const config of configs) {
      const fullKey = `rate_limit:${config.key}`
      const remaining = await this.rateLimiter.remaining(fullKey, config.maxAttempts)
      if (remaining < minRemaining) {
        minRemaining = remaining
        limit = config.maxAttempts
      }
    }

    const headers = new Headers(response.headers)
    headers.set('X-RateLimit-Limit', String(limit))
    headers.set('X-RateLimit-Remaining', String(minRemaining))

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  }
}
