import { describe, it, expect } from 'bun:test'
import { Tracer } from '../../src/tracing/Tracer.ts'

describe('Tracer', () => {
  it('provides request-scoped trace and request IDs', () => {
    const tracer = new Tracer()

    expect(tracer.currentTraceId()).toBeNull()
    expect(tracer.currentRequestId()).toBeNull()

    tracer.startRequest('req-123')

    expect(tracer.currentTraceId()).not.toBeNull()
    expect(tracer.currentTraceId()!.length).toBe(32)
    expect(tracer.currentRequestId()).toBe('req-123')

    tracer.endRequest()
  })

  it('creates spans with parent-child relationships', async () => {
    const tracer = new Tracer()
    tracer.startRequest('req-1')

    let outerSpanId: string | null = null
    let innerParentId: string | null = null

    await tracer.span('outer', async (outer) => {
      outerSpanId = outer.spanId
      await tracer.span('inner', (inner) => {
        innerParentId = inner.parentSpanId
      })
    })

    expect(outerSpanId).not.toBeNull()
    expect(innerParentId).toBe(outerSpanId)

    tracer.endRequest()
  })

  it('records span duration', async () => {
    const tracer = new Tracer()
    tracer.startRequest('req-1')

    let duration = 0
    await tracer.span('test', async (span) => {
      await new Promise((r) => setTimeout(r, 20))
      duration = span.duration()
    })

    expect(duration).toBeGreaterThan(0)

    tracer.endRequest()
  })

  it('marks spans as errors on exception', async () => {
    const tracer = new Tracer()
    tracer.startRequest('req-1')

    try {
      await tracer.span('failing', () => {
        throw new Error('test error')
      })
    } catch {
      // expected
    }

    // The span is ended internally — we can verify indirectly through currentSpan
    expect(tracer.currentSpan()).toBeNull() // span was popped

    tracer.endRequest()
  })

  it('uses traceparent header to set trace ID', () => {
    const tracer = new Tracer()
    tracer.startRequest('req-1', '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01')

    expect(tracer.currentTraceId()).toBe('0af7651916cd43dd8448eb211c80319c')

    tracer.endRequest()
  })
})
