/**
 * HTTP fake for testing — intercept requests and return stubbed responses
 * without hitting the network.
 *
 * @example
 * ```ts
 * const fake = new HttpFake()
 * fake.stub('GET', '/api/users', {
 *   status: 200,
 *   body: [{ id: 1, name: 'Alice' }],
 * })
 *
 * // Inject via middleware
 * const response = await Http.withMiddleware(fake.middleware())
 *   .get('/api/users')
 *
 * // Or replace global fetch
 * fake.install()
 * const response = await Http.get('/api/users')
 * fake.restore()
 *
 * // Assertions
 * fake.assertSent('GET', '/api/users')
 * fake.assertSentCount(1)
 * fake.assertNotSent('POST', '/api/users')
 * ```
 */

import type { HttpMiddleware, HttpResponse } from './Http.ts'

// ── Types ───────────────────────────────────────────────────────────

export interface StubResponse {
  status?: number
  statusText?: string
  headers?: Record<string, string>
  body?: any
}

export type StubHandler = (request: Request) => StubResponse | Promise<StubResponse>

interface StubEntry {
  method: string
  pattern: string | RegExp
  handler: StubHandler | StubResponse
  once: boolean
}

interface RecordedRequest {
  method: string
  url: string
  headers: Record<string, string>
  body: any
  request: Request
}

// ── HttpFake ────────────────────────────────────────────────────────

export class HttpFake {
  private stubs: StubEntry[] = []
  private recorded: RecordedRequest[] = []
  private originalFetch: typeof globalThis.fetch | null = null
  private _preventStray = false

  /**
   * Register a stub response for a method + URL pattern.
   *
   * @example
   * ```ts
   * fake.stub('GET', '/api/users', { status: 200, body: [] })
   * fake.stub('POST', /\/api\/users\/\d+/, { status: 201, body: { id: 1 } })
   * fake.stub('GET', '/api/users', (req) => ({ status: 200, body: [] }))
   * ```
   */
  stub(method: string, pattern: string | RegExp, handler: StubHandler | StubResponse): this {
    this.stubs.push({ method: method.toUpperCase(), pattern, handler, once: false })
    return this
  }

  /** Register a stub that is removed after the first match */
  stubOnce(method: string, pattern: string | RegExp, handler: StubHandler | StubResponse): this {
    this.stubs.push({ method: method.toUpperCase(), pattern, handler, once: true })
    return this
  }

  /** Shorthand stubs for common methods */
  get(pattern: string | RegExp, handler: StubHandler | StubResponse): this {
    return this.stub('GET', pattern, handler)
  }

  post(pattern: string | RegExp, handler: StubHandler | StubResponse): this {
    return this.stub('POST', pattern, handler)
  }

  put(pattern: string | RegExp, handler: StubHandler | StubResponse): this {
    return this.stub('PUT', pattern, handler)
  }

  patch(pattern: string | RegExp, handler: StubHandler | StubResponse): this {
    return this.stub('PATCH', pattern, handler)
  }

  delete(pattern: string | RegExp, handler: StubHandler | StubResponse): this {
    return this.stub('DELETE', pattern, handler)
  }

  /**
   * When enabled, any request that doesn't match a stub will throw.
   * Useful for ensuring all HTTP calls in a test are accounted for.
   */
  preventStrayRequests(): this {
    this._preventStray = true
    return this
  }

  /**
   * Register a sequence of responses that will be returned in order.
   *
   * @example
   * ```ts
   * fake.sequence('GET', '/api/status', [
   *   { status: 503 },
   *   { status: 503 },
   *   { status: 200, body: { ok: true } },
   * ])
   * ```
   */
  sequence(method: string, pattern: string | RegExp, responses: StubResponse[]): this {
    let index = 0
    return this.stub(method, pattern, () => {
      const response = responses[Math.min(index, responses.length - 1)]!
      index++
      return response
    })
  }

  // ── Middleware integration ─────────────────────────────────────────

  /**
   * Returns an HttpMiddleware that intercepts requests and returns stubs.
   * Use with Http.withMiddleware().
   *
   * @example
   * ```ts
   * const response = await Http.withMiddleware(fake.middleware()).get('/api/users')
   * ```
   */
  middleware(): HttpMiddleware {
    return async (request: Request, next: (req: Request) => Promise<Response>) => {
      await this.recordRequest(request)
      const stub = this.findStub(request)

      if (stub) {
        return this.buildResponse(request, stub)
      }

      if (this._preventStray) {
        throw new Error(`HttpFake: Unexpected request ${request.method} ${request.url}`)
      }

      return next(request)
    }
  }

  // ── Global fetch replacement ──────────────────────────────────────

  /**
   * Replace global `fetch` with the fake. Call `restore()` when done.
   */
  install(): this {
    this.originalFetch = globalThis.fetch
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init)
      await this.recordRequest(request)
      const stub = this.findStub(request)

      if (stub) {
        return this.buildResponse(request, stub)
      }

      if (this._preventStray) {
        throw new Error(`HttpFake: Unexpected request ${request.method} ${request.url}`)
      }

      return this.originalFetch!(input, init)
    }
    return this
  }

  /** Restore the original global fetch */
  restore(): void {
    if (this.originalFetch) {
      globalThis.fetch = this.originalFetch
      this.originalFetch = null
    }
  }

  // ── Assertions ────────────────────────────────────────────────────

  /** Assert that a request matching method + URL was sent */
  assertSent(method: string, pattern: string | RegExp, message?: string): void {
    const found = this.recorded.some((r) => this.matches(r, method.toUpperCase(), pattern))
    if (!found) {
      throw new Error(message ?? `Expected request ${method} ${pattern} was not sent`)
    }
  }

  /** Assert that a request was NOT sent */
  assertNotSent(method: string, pattern: string | RegExp, message?: string): void {
    const found = this.recorded.some((r) => this.matches(r, method.toUpperCase(), pattern))
    if (found) {
      throw new Error(message ?? `Unexpected request ${method} ${pattern} was sent`)
    }
  }

  /** Assert total number of requests sent */
  assertSentCount(count: number, message?: string): void {
    if (this.recorded.length !== count) {
      throw new Error(
        message ?? `Expected ${count} requests, but ${this.recorded.length} were sent`,
      )
    }
  }

  /** Assert no requests were sent */
  assertNothingSent(message?: string): void {
    this.assertSentCount(0, message ?? 'Expected no requests, but some were sent')
  }

  /**
   * Assert a request was sent and passes a custom check.
   *
   * @example
   * ```ts
   * fake.assertSentWith('POST', '/api/users', (req) => {
   *   return req.body?.name === 'Alice'
   * })
   * ```
   */
  assertSentWith(
    method: string,
    pattern: string | RegExp,
    check: (recorded: RecordedRequest) => boolean,
    message?: string,
  ): void {
    const matching = this.recorded.filter((r) => this.matches(r, method.toUpperCase(), pattern))
    const passed = matching.some(check)
    if (!passed) {
      throw new Error(message ?? `No ${method} ${pattern} request matched the assertion check`)
    }
  }

  // ── Inspection ────────────────────────────────────────────────────

  /** Get all recorded requests */
  requests(): RecordedRequest[] {
    return [...this.recorded]
  }

  /** Get recorded requests matching method + pattern */
  sent(method: string, pattern?: string | RegExp): RecordedRequest[] {
    return this.recorded.filter((r) => {
      if (r.method !== method.toUpperCase()) return false
      if (!pattern) return true
      return this.matchesPattern(r.url, pattern)
    })
  }

  /** Clear recorded requests */
  reset(): this {
    this.recorded = []
    return this
  }

  /** Clear all stubs and recorded requests */
  clear(): this {
    this.stubs = []
    this.recorded = []
    return this
  }

  // ── Internal ──────────────────────────────────────────────────────

  private findStub(request: Request): StubEntry | undefined {
    const method = request.method.toUpperCase()
    const idx = this.stubs.findIndex((s) => {
      if (s.method !== method && s.method !== '*') return false
      return this.matchesPattern(request.url, s.pattern)
    })

    if (idx === -1) return undefined
    const stub = this.stubs[idx]!
    if (stub.once) this.stubs.splice(idx, 1)
    return stub
  }

  private matchesPattern(url: string, pattern: string | RegExp): boolean {
    if (pattern instanceof RegExp) return pattern.test(url)
    // Support partial matching — pattern matches if URL ends with it or contains it
    if (url === pattern) return true
    if (url.endsWith(pattern)) return true
    try {
      const parsedUrl = new URL(url)
      return parsedUrl.pathname === pattern || parsedUrl.pathname.endsWith(pattern)
    } catch {
      return url.includes(pattern)
    }
  }

  private matches(recorded: RecordedRequest, method: string, pattern: string | RegExp): boolean {
    if (recorded.method !== method && method !== '*') return false
    return this.matchesPattern(recorded.url, pattern)
  }

  private async recordRequest(request: Request): Promise<void> {
    let body: any = null
    try {
      const cloned = request.clone()
      const text = await cloned.text()
      if (text) {
        try { body = JSON.parse(text) } catch { body = text }
      }
    } catch { /* no body */ }

    this.recorded.push({
      method: request.method.toUpperCase(),
      url: request.url,
      headers: Object.fromEntries(request.headers),
      body,
      request,
    })
  }

  private async buildResponse(request: Request, stub: StubEntry): Promise<Response> {
    const result = typeof stub.handler === 'function'
      ? await stub.handler(request)
      : stub.handler

    const status = result.status ?? 200
    const statusText = result.statusText ?? ''
    const headers = new Headers(result.headers ?? {})

    if (result.body !== undefined && result.body !== null) {
      if (!headers.has('content-type')) {
        if (typeof result.body === 'object') {
          headers.set('content-type', 'application/json')
        } else {
          headers.set('content-type', 'text/plain')
        }
      }

      const body = typeof result.body === 'object'
        ? JSON.stringify(result.body)
        : String(result.body)

      return new Response(body, { status, statusText, headers })
    }

    return new Response(null, { status, statusText, headers })
  }
}
