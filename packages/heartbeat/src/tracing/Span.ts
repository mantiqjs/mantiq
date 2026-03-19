import type { SpanStatus } from '../contracts/Entry.ts'

/**
 * Represents a single timed operation in a distributed trace.
 */
export class Span {
  readonly traceId: string
  readonly spanId: string
  readonly parentSpanId: string | null
  readonly name: string
  readonly type: string

  startTime: number
  endTime: number | null = null
  status: SpanStatus = 'ok'
  attributes: Record<string, string | number | boolean> = {}
  events: Array<{ name: string; timestamp: number; attributes?: Record<string, any> }> = []

  constructor(
    traceId: string,
    spanId: string,
    parentSpanId: string | null,
    name: string,
    type: string,
  ) {
    this.traceId = traceId
    this.spanId = spanId
    this.parentSpanId = parentSpanId
    this.name = name
    this.type = type
    this.startTime = Bun.nanoseconds()
  }

  /**
   * End the span and record the end time.
   */
  end(): void {
    if (this.endTime === null) {
      this.endTime = Bun.nanoseconds()
    }
  }

  /**
   * Get the duration in milliseconds.
   */
  duration(): number {
    const end = this.endTime ?? Bun.nanoseconds()
    return (end - this.startTime) / 1_000_000
  }

  /**
   * Set an attribute on the span.
   */
  setAttribute(key: string, value: string | number | boolean): this {
    this.attributes[key] = value
    return this
  }

  /**
   * Add an event to the span timeline.
   */
  addEvent(name: string, attributes?: Record<string, any>): this {
    this.events.push({ name, timestamp: Bun.nanoseconds(), attributes })
    return this
  }

  /**
   * Mark the span as errored with an exception.
   */
  setError(error: Error): void {
    this.status = 'error'
    this.setAttribute('error.type', error.constructor.name)
    this.setAttribute('error.message', error.message)
    this.addEvent('exception', {
      'exception.type': error.constructor.name,
      'exception.message': error.message,
      'exception.stacktrace': error.stack ?? '',
    })
  }

  /**
   * Serialize for storage.
   */
  toJSON() {
    return {
      traceId: this.traceId,
      spanId: this.spanId,
      parentSpanId: this.parentSpanId,
      name: this.name,
      type: this.type,
      status: this.status,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.endTime ? (this.endTime - this.startTime) / 1_000_000 : null,
      attributes: this.attributes,
      events: this.events,
    }
  }
}
