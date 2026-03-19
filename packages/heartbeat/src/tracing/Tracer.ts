import { AsyncLocalStorage } from 'node:async_hooks'
import { Span } from './Span.ts'
import { generateTraceId, generateSpanId, parseTraceparent } from './TraceContext.ts'
import type { HeartbeatStore } from '../storage/HeartbeatStore.ts'

interface TraceState {
  traceId: string
  requestId: string
  spanStack: Span[]
}

/**
 * Distributed tracer using AsyncLocalStorage for request-scoped context.
 *
 * Provides automatic parent-child span relationships and
 * request-scoped trace IDs without manual context threading.
 */
export class Tracer {
  private ctx = new AsyncLocalStorage<TraceState>()
  private store: HeartbeatStore | null = null

  setStore(store: HeartbeatStore): void {
    this.store = store
  }

  /**
   * Start a new request trace context.
   * Should be called at the beginning of each HTTP request.
   */
  startRequest(requestId: string, traceparent?: string): void {
    let traceId: string
    if (traceparent) {
      const parsed = parseTraceparent(traceparent)
      traceId = parsed?.traceId ?? generateTraceId()
    } else {
      traceId = generateTraceId()
    }

    this.ctx.enterWith({
      traceId,
      requestId,
      spanStack: [],
    })
  }

  /**
   * End the current request trace context.
   */
  endRequest(): void {
    this.ctx.disable()
    this.ctx = new AsyncLocalStorage<TraceState>()
  }

  /**
   * Execute a callback within a new span.
   * Automatically sets parent-child relationships from the span stack.
   */
  async span<T>(name: string, callback: (span: Span) => T | Promise<T>, type = 'internal'): Promise<T> {
    const state = this.ctx.getStore()
    const traceId = state?.traceId ?? generateTraceId()
    const parentSpan = state?.spanStack[state.spanStack.length - 1] ?? null
    const spanId = generateSpanId()

    const span = new Span(traceId, spanId, parentSpan?.spanId ?? null, name, type)

    if (state) {
      state.spanStack.push(span)
    }

    try {
      const result = await callback(span)
      span.end()
      this.persistSpan(span)
      return result
    } catch (error) {
      span.setError(error instanceof Error ? error : new Error(String(error)))
      span.end()
      this.persistSpan(span)
      throw error
    } finally {
      if (state) {
        state.spanStack.pop()
      }
    }
  }

  /**
   * Get the current trace ID, if inside a request context.
   */
  currentTraceId(): string | null {
    return this.ctx.getStore()?.traceId ?? null
  }

  /**
   * Get the current request ID, if inside a request context.
   */
  currentRequestId(): string | null {
    return this.ctx.getStore()?.requestId ?? null
  }

  /**
   * Get the current active span, if any.
   */
  currentSpan(): Span | null {
    const state = this.ctx.getStore()
    if (!state || state.spanStack.length === 0) return null
    return state.spanStack[state.spanStack.length - 1]!
  }

  private persistSpan(span: Span): void {
    if (!this.store) return
    // Fire-and-forget — async store, but observability must never crash the app
    this.store.insertSpan(span.toJSON()).catch(() => {})
  }
}
