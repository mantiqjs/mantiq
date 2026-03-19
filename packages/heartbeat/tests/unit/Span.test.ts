import { describe, it, expect } from 'bun:test'
import { Span } from '../../src/tracing/Span.ts'

describe('Span', () => {
  it('records start time on creation', () => {
    const span = new Span('trace-1', 'span-1', null, 'test', 'internal')
    expect(span.startTime).toBeGreaterThan(0)
    expect(span.endTime).toBeNull()
    expect(span.status).toBe('ok')
  })

  it('computes duration after end()', () => {
    const span = new Span('trace-1', 'span-1', null, 'test', 'internal')
    span.end()
    expect(span.endTime).not.toBeNull()
    expect(span.duration()).toBeGreaterThanOrEqual(0)
  })

  it('sets attributes', () => {
    const span = new Span('trace-1', 'span-1', null, 'test', 'internal')
    span.setAttribute('http.method', 'GET').setAttribute('http.status_code', 200)
    expect(span.attributes['http.method']).toBe('GET')
    expect(span.attributes['http.status_code']).toBe(200)
  })

  it('adds events', () => {
    const span = new Span('trace-1', 'span-1', null, 'test', 'internal')
    span.addEvent('query_start', { sql: 'SELECT 1' })
    expect(span.events).toHaveLength(1)
    expect(span.events[0]!.name).toBe('query_start')
    expect(span.events[0]!.attributes).toEqual({ sql: 'SELECT 1' })
  })

  it('records error information', () => {
    const span = new Span('trace-1', 'span-1', null, 'test', 'internal')
    span.setError(new TypeError('Cannot read property'))

    expect(span.status).toBe('error')
    expect(span.attributes['error.type']).toBe('TypeError')
    expect(span.attributes['error.message']).toBe('Cannot read property')
    expect(span.events).toHaveLength(1)
    expect(span.events[0]!.name).toBe('exception')
  })

  it('serializes to JSON', () => {
    const span = new Span('trace-1', 'span-1', 'parent-1', 'http.request', 'http')
    span.setAttribute('method', 'GET')
    span.end()

    const json = span.toJSON()
    expect(json.traceId).toBe('trace-1')
    expect(json.spanId).toBe('span-1')
    expect(json.parentSpanId).toBe('parent-1')
    expect(json.name).toBe('http.request')
    expect(json.type).toBe('http')
    expect(json.status).toBe('ok')
    expect(json.duration).toBeGreaterThanOrEqual(0)
    expect(json.attributes.method).toBe('GET')
  })
})
