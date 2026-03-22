import type { Middleware, NextFunction, MantiqRequest } from '@mantiq/core'
import type { Heartbeat } from '../Heartbeat.ts'
import type { Tracer } from '../tracing/Tracer.ts'
import type { RequestWatcher } from '../watchers/RequestWatcher.ts'
import type { MetricsCollector } from '../metrics/MetricsCollector.ts'
import { renderWidget } from '../widget/DebugWidget.ts'

/** Max response body size to capture (16 KB). */
const MAX_RESPONSE_BODY = 16_384

/** Static asset extensions to skip. */
const ASSET_PATTERN = /\.(js|css|map|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|webp|avif|mp4|webm)(\?.*)?$/i

/**
 * Global middleware that captures full request/response lifecycle for Heartbeat.
 *
 * - Starts a trace context (request ID + root span)
 * - Captures request headers, query, body, cookies
 * - Captures response headers, body, size
 * - Records timing, status, memory usage
 * - Feeds data into RequestWatcher + MetricsCollector
 */
export class HeartbeatMiddleware implements Middleware {
  private heartbeat: Heartbeat
  private tracer: Tracer | null
  private requestWatcher: RequestWatcher | null
  private metrics: MetricsCollector | null

  constructor(
    heartbeat: Heartbeat,
    tracer: Tracer | null,
    requestWatcher: RequestWatcher | null,
    metrics: MetricsCollector | null,
  ) {
    this.heartbeat = heartbeat
    this.tracer = tracer
    this.requestWatcher = requestWatcher
    this.metrics = metrics
  }

  async handle(request: MantiqRequest, next: NextFunction): Promise<Response> {
    if (!this.heartbeat.config.enabled) return next()

    // Skip heartbeat's own dashboard requests
    const dashboardPath = this.heartbeat.config.dashboard.path
    if (request.path().startsWith(dashboardPath)) return next()

    // Skip static asset requests
    if (ASSET_PATTERN.test(request.path())) return next()

    const startTime = performance.now()
    const startMemory = process.memoryUsage().rss

    // Capture request data before the pipeline consumes the body
    const requestHeaders = request.headers()
    const requestQuery = request.query()
    const requestCookies = this.parseCookies(request)
    let requestBody: Record<string, any> | null = null
    try {
      requestBody = await request.input()
      if (requestBody && Object.keys(requestBody).length === 0) requestBody = null
    } catch {
      // Body may not be parseable
    }

    // Start trace context
    const requestId = crypto.randomUUID()
    if (this.tracer) {
      const traceparent = request.header('traceparent') ?? undefined
      this.tracer.startRequest(requestId, traceparent)
    }

    let response: Response
    let error: Error | null = null

    try {
      if (this.tracer) {
        response = await this.tracer.span('http.request', async (span) => {
          span.setAttribute('http.method', request.method())
          span.setAttribute('http.url', request.path())

          const res = await next()

          span.setAttribute('http.status_code', res.status)
          if (res.status >= 400) span.status = 'error'

          return res
        }, 'http')
      } else {
        response = await next()
      }
    } catch (err) {
      error = err as Error
      throw err
    } finally {
      const duration = performance.now() - startTime

      if (this.tracer) {
        this.tracer.endRequest()
      }

      // Capture response data (must rebuild response so body stays available for upstream middleware)
      if (this.requestWatcher && !error) {
        const responseHeaders = this.captureResponseHeaders(response!)
        const { body: responseBody, size: responseSize, rebuilt } = await this.captureResponseBody(response!)
        if (rebuilt) response = rebuilt

        this.requestWatcher.recordRequest({
          method: request.method(),
          path: request.path(),
          url: request.url(),
          status: response!.status,
          duration,
          ip: request.ip(),
          middleware: [],
          controller: null,
          routeName: null,
          memoryUsage: process.memoryUsage().rss - startMemory,
          requestHeaders,
          requestQuery,
          requestBody,
          requestCookies,
          responseHeaders,
          responseSize,
          responseBody,
          userId: request.isAuthenticated() ? (request.user()?.id ?? null) : null,
        })
      }

      // Record metrics
      if (this.metrics) {
        this.metrics.increment('http.requests.total')
        this.metrics.observe('http.requests.duration', duration)
        if (response! && response!.status >= 500) {
          this.metrics.increment('http.errors.total')
        }
      }

      // Flush entries (fire-and-forget)
      this.heartbeat.flush()
    }

    // Debug mode: attach X-Heartbeat header + inject widget
    // Only for browser requests (HTML pages or SPA navigation), not raw API calls
    if (process.env.APP_DEBUG === 'true' && response!) {
      const ct = response!.headers.get('content-type') ?? ''
      const isHtml = ct.includes('text/html') && response!.status < 400
      const isSPA = request.header('X-Mantiq') === 'true'

      if (isHtml || isSPA) {
        const totalDuration = performance.now() - startTime
        const totalMemory = Math.abs(process.memoryUsage().rss - startMemory)
        const mem = (totalMemory / 1024 / 1024).toFixed(1)
        const statsHeader = `${Math.round(totalDuration)}ms;${mem}MB;${response!.status};0q`

        try {
          const cloned = response!.clone()
          const body = await cloned.text()
          const headers = new Headers(response!.headers)

          headers.set('X-Heartbeat', statsHeader)
          headers.set('Access-Control-Expose-Headers', [headers.get('Access-Control-Expose-Headers'), 'X-Heartbeat'].filter(Boolean).join(', '))

          let finalBody = body
          if (isHtml && this.heartbeat.config.widget?.enabled !== false && body.includes('</body>')) {
            const widget = renderWidget({
              duration: totalDuration,
              memory: totalMemory,
              status: response!.status,
              queries: 0,
              dashboardPath: this.heartbeat.config.dashboard.path,
            })
            finalBody = body.replace('</body>', widget + '\n</body>')
          }

          response = new Response(finalBody, { status: response!.status, statusText: response!.statusText, headers })
        } catch (e) { console.error('[Heartbeat Widget]', e) }
      }
    }

    return response!
  }

  private parseCookies(request: MantiqRequest): Record<string, string> {
    const header = request.header('cookie')
    if (!header) return {}
    const cookies: Record<string, string> = {}
    for (const pair of header.split(';')) {
      const eqIdx = pair.indexOf('=')
      if (eqIdx === -1) continue
      const key = pair.slice(0, eqIdx).trim()
      // Redact cookie values — just record which cookies are present
      cookies[key] = '********'
    }
    return cookies
  }

  private captureResponseHeaders(response: Response): Record<string, string> {
    const headers: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      // Redact set-cookie values
      if (key.toLowerCase() === 'set-cookie') {
        headers[key] = '********'
      } else {
        headers[key] = value
      }
    })
    return headers
  }

  private async captureResponseBody(response: Response): Promise<{ body: string | null; size: number | null; rebuilt: Response | null }> {
    const contentType = response.headers.get('content-type') ?? ''

    // Only capture JSON responses
    const isCaptureable = contentType.includes('application/json')

    if (!isCaptureable || !response.body) {
      const size = parseInt(response.headers.get('content-length') ?? '0', 10) || null
      return { body: null, size, rebuilt: null }
    }

    try {
      // Read the body text — this consumes the stream
      const text = await response.text()
      const size = text.length

      // Truncate large responses for logging
      const body = text.length > MAX_RESPONSE_BODY
        ? text.slice(0, MAX_RESPONSE_BODY) + `... (truncated, ${text.length} bytes total)`
        : text

      // Rebuild the response so upstream middleware still has a body
      const rebuilt = new Response(text, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      })

      return { body, size, rebuilt }
    } catch {
      return { body: null, size: null, rebuilt: null }
    }
  }

}
