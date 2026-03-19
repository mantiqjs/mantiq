import type { Tracer } from './Tracer.ts'
import { createTraceparent } from './TraceContext.ts'
import { generateSpanId } from './TraceContext.ts'

/**
 * Creates a middleware function that starts a root span for each HTTP request.
 * Should be injected as the first global middleware.
 *
 * Sets up the trace context for the entire request lifecycle so all
 * watchers and spans within the request share the same trace ID.
 */
export function createRequestTraceMiddleware(tracer: Tracer, propagate: boolean) {
  return async (request: Request, next: (req: Request) => Promise<Response>): Promise<Response> => {
    const requestId = crypto.randomUUID()
    const traceparent = request.headers.get('traceparent') ?? undefined

    tracer.startRequest(requestId, traceparent)

    const response = await tracer.span('http.request', async (span) => {
      span.setAttribute('http.method', request.method)
      span.setAttribute('http.url', new URL(request.url).pathname)

      const res = await next(request)

      span.setAttribute('http.status_code', res.status)
      if (res.status >= 400) {
        span.status = 'error'
      }

      // Propagate trace context in response if enabled
      if (propagate) {
        const traceId = tracer.currentTraceId()
        if (traceId) {
          const headers = new Headers(res.headers)
          headers.set('traceparent', createTraceparent(traceId, generateSpanId()))
          return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
        }
      }

      return res
    }, 'http')

    tracer.endRequest()
    return response
  }
}
