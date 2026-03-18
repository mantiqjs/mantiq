import type { Middleware, NextFunction } from '../contracts/Middleware.ts'
import type { MantiqRequest } from '../contracts/Request.ts'
import { ConfigRepository } from '../config/ConfigRepository.ts'

interface CorsConfig {
  origin: string | string[] | '*'
  methods: string[]
  allowedHeaders: string[]
  exposedHeaders: string[]
  credentials: boolean
  maxAge: number
}

/**
 * Cross-Origin Resource Sharing middleware.
 * Configure via config/cors.ts.
 */
export class CorsMiddleware implements Middleware {
  private config: CorsConfig

  constructor(configRepo?: ConfigRepository) {
    this.config = {
      origin: configRepo?.get('cors.origin', '*') ?? '*',
      methods: configRepo?.get('cors.methods', ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) ?? ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: configRepo?.get('cors.allowedHeaders', ['Content-Type', 'Authorization', 'X-Requested-With']) ?? ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: configRepo?.get('cors.exposedHeaders', []) ?? [],
      credentials: configRepo?.get('cors.credentials', false) ?? false,
      maxAge: configRepo?.get('cors.maxAge', 0) ?? 0,
    }
  }

  async handle(request: MantiqRequest, next: NextFunction): Promise<Response> {
    const origin = request.header('origin') ?? ''

    // Handle preflight
    if (request.method() === 'OPTIONS') {
      return this.buildPreflightResponse(origin)
    }

    const response = await next()
    return this.addCorsHeaders(response, origin)
  }

  private buildPreflightResponse(origin: string): Response {
    const headers: Record<string, string> = {
      'Access-Control-Allow-Methods': this.config.methods.join(', '),
      'Access-Control-Allow-Headers': this.config.allowedHeaders.join(', '),
    }

    this.applyOriginHeader(headers, origin)

    if (this.config.credentials) headers['Access-Control-Allow-Credentials'] = 'true'
    if (this.config.maxAge > 0) headers['Access-Control-Max-Age'] = String(this.config.maxAge)
    if (this.config.exposedHeaders.length > 0) {
      headers['Access-Control-Expose-Headers'] = this.config.exposedHeaders.join(', ')
    }

    return new Response(null, { status: 204, headers })
  }

  private addCorsHeaders(response: Response, origin: string): Response {
    const headers = new Headers(response.headers)
    this.applyOriginHeader(headers as any, origin)
    if (this.config.credentials) headers.set('Access-Control-Allow-Credentials', 'true')
    return new Response(response.body, { status: response.status, headers })
  }

  private applyOriginHeader(headers: Record<string, string>, requestOrigin: string): void {
    const { origin } = this.config
    if (origin === '*') {
      headers['Access-Control-Allow-Origin'] = '*'
    } else if (Array.isArray(origin)) {
      if (origin.includes(requestOrigin)) {
        headers['Access-Control-Allow-Origin'] = requestOrigin
        headers['Vary'] = 'Origin'
      }
    } else if (origin === requestOrigin) {
      headers['Access-Control-Allow-Origin'] = requestOrigin
      headers['Vary'] = 'Origin'
    }
  }
}
