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
    // Smart default: use APP_URL as origin with credentials when available
    const appUrl = configRepo?.get('app.url', '') as string
    const defaultOrigin = appUrl || '*'
    const defaultCredentials = !!appUrl

    this.config = {
      origin: configRepo?.get('cors.origin', defaultOrigin) ?? defaultOrigin,
      methods: configRepo?.get('cors.methods', ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) ?? ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: configRepo?.get('cors.allowedHeaders', ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-TOKEN', 'X-XSRF-TOKEN', 'X-Mantiq']) ?? ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-TOKEN', 'X-XSRF-TOKEN', 'X-Mantiq'],
      exposedHeaders: configRepo?.get('cors.exposedHeaders', ['X-Heartbeat']) ?? ['X-Heartbeat'],
      credentials: configRepo?.get('cors.credentials', defaultCredentials) ?? defaultCredentials,
      maxAge: configRepo?.get('cors.maxAge', 7200) ?? 7200,
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
    this.setOriginHeader(headers, origin)
    if (this.config.credentials) headers.set('Access-Control-Allow-Credentials', 'true')
    if (this.config.exposedHeaders.length > 0) {
      headers.set('Access-Control-Expose-Headers', this.config.exposedHeaders.join(', '))
    }
    return new Response(response.body, { status: response.status, headers })
  }

  private setOriginHeader(headers: Headers, requestOrigin: string): void {
    const { origin } = this.config
    if (origin === '*') {
      headers.set('Access-Control-Allow-Origin', '*')
    } else if (Array.isArray(origin)) {
      if (origin.includes(requestOrigin)) {
        headers.set('Access-Control-Allow-Origin', requestOrigin)
        headers.set('Vary', 'Origin')
      }
    } else if (origin === requestOrigin) {
      headers.set('Access-Control-Allow-Origin', requestOrigin)
      headers.set('Vary', 'Origin')
    }
  }

  private applyOriginHeader(headers: Record<string, string>, requestOrigin: string): void {
    const tmp = new Headers()
    this.setOriginHeader(tmp, requestOrigin)
    tmp.forEach((v, k) => { headers[k] = v })
  }
}
