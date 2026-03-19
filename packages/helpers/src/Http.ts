/**
 * Fluent HTTP client with batch requests, request pipelines, and middleware.
 *
 * @example
 * ```ts
 * // Simple request
 * const { data } = await Http.get('https://api.example.com/users')
 *
 * // Fluent builder
 * const response = await Http.baseUrl('https://api.example.com')
 *   .bearer('token-123')
 *   .accept('application/json')
 *   .timeout('5s')
 *   .get('/users')
 *
 * // Batch requests (parallel)
 * const [users, posts] = await Http.batch([
 *   Http.get('https://api.example.com/users'),
 *   Http.get('https://api.example.com/posts'),
 * ])
 *
 * // Pipeline (sequential, each step receives prior response)
 * const result = await Http.pipeline(
 *   Http.post('https://api.example.com/auth', { user: 'admin', pass: 'secret' }),
 *   (authResponse) => Http.baseUrl('https://api.example.com')
 *     .bearer(authResponse.data.token)
 *     .get('/profile'),
 * )
 * ```
 */

import { parseDuration } from './async.ts'

// ── Types ───────────────────────────────────────────────────────────

export interface HttpResponse<T = any> {
  data: T
  status: number
  statusText: string
  headers: Headers
  ok: boolean
  url: string
}

export interface HttpError extends Error {
  response?: HttpResponse
  status?: number
}

export type HttpMiddleware = (
  request: Request,
  next: (request: Request) => Promise<Response>,
) => Promise<Response>

export type RetryConfig = {
  times: number
  delay?: string | number
  when?: (response: HttpResponse) => boolean
}

// ── PendingRequest (fluent builder) ─────────────────────────────────

export class PendingRequest {
  private _baseUrl = ''
  private _headers: Record<string, string> = {}
  private _query: Record<string, string> = {}
  private _timeout: number | null = null
  private _retry: RetryConfig | null = null
  private _middleware: HttpMiddleware[] = []
  private _bodyType: 'json' | 'form' | 'multipart' | 'raw' = 'json'
  private _sink: string | WritableStream | null = null

  /** Set the base URL for all requests */
  baseUrl(url: string): this {
    this._baseUrl = url.replace(/\/+$/, '')
    return this
  }

  /** Set a request header */
  withHeader(name: string, value: string): this {
    this._headers[name] = value
    return this
  }

  /** Set multiple headers */
  withHeaders(headers: Record<string, string>): this {
    Object.assign(this._headers, headers)
    return this
  }

  /** Set Authorization: Bearer token */
  bearer(token: string): this {
    this._headers['Authorization'] = `Bearer ${token}`
    return this
  }

  /** Set basic auth */
  basicAuth(username: string, password: string): this {
    this._headers['Authorization'] = `Basic ${btoa(`${username}:${password}`)}`
    return this
  }

  /** Set Accept header */
  accept(contentType: string): this {
    this._headers['Accept'] = contentType
    return this
  }

  /** Set Content-Type header */
  contentType(type: string): this {
    this._headers['Content-Type'] = type
    return this
  }

  /** Send body as JSON (default) */
  asJson(): this {
    this._bodyType = 'json'
    return this
  }

  /** Send body as application/x-www-form-urlencoded */
  asForm(): this {
    this._bodyType = 'form'
    return this
  }

  /** Send body as multipart/form-data */
  asMultipart(): this {
    this._bodyType = 'multipart'
    return this
  }

  /**
   * Stream the response body to a file path or a WritableStream.
   * When a file path is given, `data` in the response will be the file path.
   * When a WritableStream is given, `data` will be null.
   *
   * @example
   * ```ts
   * // Sink to a local file
   * const { data: filePath } = await Http.create()
   *   .sink('/tmp/report.pdf')
   *   .get('https://example.com/report.pdf')
   *
   * // Sink to a writable stream
   * const file = Bun.file('/tmp/report.pdf').writer()
   * await Http.create()
   *   .sink(writableStream)
   *   .get('https://example.com/report.pdf')
   * ```
   */
  sink(path: string | WritableStream): this {
    this._sink = path
    return this
  }

  /** Add query parameters */
  query(params: Record<string, string | number | boolean>): this {
    for (const [k, v] of Object.entries(params)) {
      this._query[k] = String(v)
    }
    return this
  }

  /** Set request timeout */
  timeout(duration: string | number): this {
    this._timeout = parseDuration(duration)
    return this
  }

  /** Configure retry behavior */
  retry(times: number, delay?: string | number, when?: (response: HttpResponse) => boolean): this {
    this._retry = { times, delay, when }
    return this
  }

  /** Add middleware to the request pipeline */
  withMiddleware(middleware: HttpMiddleware): this {
    this._middleware.push(middleware)
    return this
  }

  // ── HTTP methods ──────────────────────────────────────────────────

  get<T = any>(url: string): Promise<HttpResponse<T>> {
    return this.send<T>('GET', url)
  }

  post<T = any>(url: string, body?: any): Promise<HttpResponse<T>> {
    return this.send<T>('POST', url, body)
  }

  put<T = any>(url: string, body?: any): Promise<HttpResponse<T>> {
    return this.send<T>('PUT', url, body)
  }

  patch<T = any>(url: string, body?: any): Promise<HttpResponse<T>> {
    return this.send<T>('PATCH', url, body)
  }

  delete<T = any>(url: string, body?: any): Promise<HttpResponse<T>> {
    return this.send<T>('DELETE', url, body)
  }

  head(url: string): Promise<HttpResponse<null>> {
    return this.send<null>('HEAD', url)
  }

  options<T = any>(url: string): Promise<HttpResponse<T>> {
    return this.send<T>('OPTIONS', url)
  }

  // ── Core send ─────────────────────────────────────────────────────

  async send<T = any>(method: string, url: string, body?: any): Promise<HttpResponse<T>> {
    const fullUrl = this.buildUrl(url)
    const request = this.buildRequest(method, fullUrl, body)

    const execute = async (): Promise<HttpResponse<T>> => {
      const response = await this.executeWithMiddleware(request.clone())
      return this.parseResponse<T>(response, fullUrl)
    }

    if (this._retry) {
      return this.executeWithRetry<T>(execute, this._retry)
    }

    return execute()
  }

  // ── Internal ──────────────────────────────────────────────────────

  private buildUrl(url: string): string {
    const fullUrl = url.startsWith('http') ? url : `${this._baseUrl}${url.startsWith('/') ? '' : '/'}${url}`
    const queryString = new URLSearchParams(this._query).toString()
    return queryString ? `${fullUrl}?${queryString}` : fullUrl
  }

  private buildRequest(method: string, url: string, body?: any): Request {
    const headers = new Headers(this._headers)
    const init: RequestInit = { method, headers }

    if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
      if (this._bodyType === 'json') {
        if (!headers.has('Content-Type')) {
          headers.set('Content-Type', 'application/json')
        }
        init.body = JSON.stringify(body)
      } else if (this._bodyType === 'form') {
        headers.set('Content-Type', 'application/x-www-form-urlencoded')
        init.body = new URLSearchParams(body).toString()
      } else if (this._bodyType === 'multipart') {
        // Let the browser set the boundary in Content-Type
        if (body instanceof FormData) {
          init.body = body
        } else {
          const formData = new FormData()
          for (const [k, v] of Object.entries(body)) {
            formData.append(k, v as string | Blob)
          }
          init.body = formData
        }
        // Remove Content-Type so browser sets multipart boundary
        headers.delete('Content-Type')
      } else {
        init.body = body
      }
    }

    if (this._timeout !== null) {
      init.signal = AbortSignal.timeout(this._timeout)
    }

    return new Request(url, init)
  }

  private async executeWithMiddleware(request: Request): Promise<Response> {
    const stack = [...this._middleware]

    const dispatch = async (req: Request): Promise<Response> => {
      const middleware = stack.shift()
      if (middleware) {
        return middleware(req, dispatch)
      }
      return fetch(req)
    }

    return dispatch(request)
  }

  private async parseResponse<T>(response: Response, url: string): Promise<HttpResponse<T>> {
    let data: any = null

    // Sink: stream body to a file or writable stream
    if (this._sink && response.ok && response.body) {
      if (typeof this._sink === 'string') {
        const bytes = await response.arrayBuffer()
        await Bun.write(this._sink, bytes)
        data = this._sink
      } else {
        await response.body.pipeTo(this._sink)
        data = null
      }
    } else {
      const contentType = response.headers.get('content-type') ?? ''
      if (contentType.includes('application/json')) {
        data = await response.json()
      } else if (contentType.includes('text/')) {
        data = await response.text()
      } else if (response.status !== 204 && response.status !== 304) {
        // Try JSON first, fall back to text
        const text = await response.text()
        try {
          data = JSON.parse(text)
        } catch {
          data = text
        }
      }
    }

    const result: HttpResponse<T> = {
      data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      ok: response.ok,
      url,
    }

    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`) as HttpError
      error.response = result
      error.status = response.status
      throw error
    }

    return result
  }

  private async executeWithRetry<T>(
    execute: () => Promise<HttpResponse<T>>,
    config: RetryConfig,
  ): Promise<HttpResponse<T>> {
    let lastError: Error | undefined
    const delay = config.delay ? parseDuration(config.delay) : 0

    for (let attempt = 0; attempt <= config.times; attempt++) {
      try {
        const response = await execute()

        // Check if we should retry based on the response
        if (config.when && attempt < config.times && config.when(response)) {
          if (delay > 0) await new Promise((r) => setTimeout(r, delay))
          continue
        }

        return response
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e))
        if (attempt < config.times) {
          if (delay > 0) await new Promise((r) => setTimeout(r, delay))
        }
      }
    }

    throw lastError
  }
}

// ── Static Http facade ──────────────────────────────────────────────

export const Http = {
  /** Create a new fluent request builder */
  create(): PendingRequest {
    return new PendingRequest()
  },

  /** Create a builder with a base URL */
  baseUrl(url: string): PendingRequest {
    return new PendingRequest().baseUrl(url)
  },

  /** Create a builder with a bearer token */
  bearer(token: string): PendingRequest {
    return new PendingRequest().bearer(token)
  },

  /** Create a builder with custom headers */
  withHeaders(headers: Record<string, string>): PendingRequest {
    return new PendingRequest().withHeaders(headers)
  },

  /** Create a builder with middleware */
  withMiddleware(middleware: HttpMiddleware): PendingRequest {
    return new PendingRequest().withMiddleware(middleware)
  },

  /** Create a builder with timeout */
  timeout(duration: string | number): PendingRequest {
    return new PendingRequest().timeout(duration)
  },

  /** Create a builder with retry config */
  retry(times: number, delay?: string | number): PendingRequest {
    return new PendingRequest().retry(times, delay)
  },

  // ── Shorthand methods ─────────────────────────────────────────────

  get<T = any>(url: string): Promise<HttpResponse<T>> {
    return new PendingRequest().get<T>(url)
  },

  post<T = any>(url: string, body?: any): Promise<HttpResponse<T>> {
    return new PendingRequest().post<T>(url, body)
  },

  put<T = any>(url: string, body?: any): Promise<HttpResponse<T>> {
    return new PendingRequest().put<T>(url, body)
  },

  patch<T = any>(url: string, body?: any): Promise<HttpResponse<T>> {
    return new PendingRequest().patch<T>(url, body)
  },

  delete<T = any>(url: string, body?: any): Promise<HttpResponse<T>> {
    return new PendingRequest().delete<T>(url, body)
  },

  head(url: string): Promise<HttpResponse<null>> {
    return new PendingRequest().head(url)
  },

  options<T = any>(url: string): Promise<HttpResponse<T>> {
    return new PendingRequest().options<T>(url)
  },

  // ── Batch (parallel requests) ─────────────────────────────────────

  /**
   * Execute multiple requests in parallel.
   * Returns an array of responses in the same order.
   *
   * @example
   * ```ts
   * const [users, posts, comments] = await Http.batch([
   *   Http.get('/api/users'),
   *   Http.get('/api/posts'),
   *   Http.get('/api/comments'),
   * ])
   * ```
   */
  async batch<T extends Promise<HttpResponse>[]>(
    requests: [...T],
  ): Promise<{ [K in keyof T]: Awaited<T[K]> }> {
    return Promise.all(requests) as any
  },

  /**
   * Execute multiple requests in parallel, settling all (no short-circuit on error).
   * Returns an array of { status, value?, reason? } results.
   *
   * @example
   * ```ts
   * const results = await Http.batchSettled([
   *   Http.get('/api/users'),
   *   Http.get('/api/might-fail'),
   * ])
   * results.forEach(r => {
   *   if (r.status === 'fulfilled') console.log(r.value.data)
   *   else console.error(r.reason)
   * })
   * ```
   */
  async batchSettled<T extends Promise<HttpResponse>[]>(
    requests: [...T],
  ): Promise<{ [K in keyof T]: PromiseSettledResult<Awaited<T[K]>> }> {
    return Promise.allSettled(requests) as any
  },

  /**
   * Execute requests in parallel with a concurrency limit.
   *
   * @example
   * ```ts
   * const urls = Array.from({ length: 100 }, (_, i) => `/api/item/${i}`)
   * const responses = await Http.pool(
   *   urls.map(url => () => Http.get(url)),
   *   { concurrency: 5 },
   * )
   * ```
   */
  async pool<T = any>(
    factories: Array<() => Promise<HttpResponse<T>>>,
    options: { concurrency: number },
  ): Promise<HttpResponse<T>[]> {
    const results: HttpResponse<T>[] = new Array(factories.length)
    let nextIndex = 0

    async function runNext(): Promise<void> {
      while (nextIndex < factories.length) {
        const idx = nextIndex++
        results[idx] = await factories[idx]!()
      }
    }

    const workers = Array.from(
      { length: Math.min(options.concurrency, factories.length) },
      () => runNext(),
    )

    await Promise.all(workers)
    return results
  },

  // ── Pipeline (sequential with data passing) ───────────────────────

  /**
   * Execute requests sequentially — each step receives the previous response.
   * The first argument is a request promise, subsequent arguments are functions
   * that receive the prior response and return the next request.
   *
   * @example
   * ```ts
   * // Auth → fetch profile → fetch settings
   * const settings = await Http.pipeline(
   *   Http.post('/auth', { user: 'admin', pass: 'secret' }),
   *   (auth) => Http.bearer(auth.data.token).get('/profile'),
   *   (profile) => Http.bearer(profile.data.token).get(`/settings/${profile.data.id}`),
   * )
   * // settings is the final HttpResponse
   * ```
   */
  async pipeline<T = any>(
    first: Promise<HttpResponse>,
    ...steps: Array<(response: HttpResponse) => Promise<HttpResponse>>
  ): Promise<HttpResponse<T>> {
    let response = await first
    for (const step of steps) {
      response = await step(response)
    }
    return response as HttpResponse<T>
  },

  /**
   * Build a reusable pipeline of request transformations.
   * Returns a function that accepts an initial request and runs the full chain.
   *
   * @example
   * ```ts
   * const authenticatedFetch = Http.createPipeline(
   *   (auth) => Http.bearer(auth.data.token).get('/profile'),
   *   (profile) => Http.bearer(profile.data.token).get(`/data/${profile.data.id}`),
   * )
   *
   * // Use it with different auth requests
   * const result = await authenticatedFetch(
   *   Http.post('/auth', { user: 'admin', pass: 'secret' })
   * )
   * ```
   */
  createPipeline<T = any>(
    ...steps: Array<(response: HttpResponse) => Promise<HttpResponse>>
  ): (initial: Promise<HttpResponse>) => Promise<HttpResponse<T>> {
    return async (initial) => {
      let response = await initial
      for (const step of steps) {
        response = await step(response)
      }
      return response as HttpResponse<T>
    }
  },
}
