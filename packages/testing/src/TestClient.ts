import { TestResponse } from './TestResponse.ts'

/**
 * HTTP test client that sends requests directly to the MantiqJS kernel.
 *
 * Maintains cookies across requests (like a browser session).
 * Handles CSRF tokens automatically for stateful routes.
 *
 * @example
 *   const client = new TestClient(app)
 *   const res = await client.post('/login', { email: '...', password: '...' })
 *   res.assertOk()
 */
export class TestClient {
  private cookies: Map<string, string> = new Map()
  private defaultHeaders: Record<string, string> = {}

  constructor(
    private readonly handler: (request: Request) => Promise<Response>,
    private readonly baseUrl = 'http://localhost',
  ) {}

  // ── Configuration ─────────────────────────────────────────────────────

  /** Set default headers for all requests. */
  withHeaders(headers: Record<string, string>): this {
    Object.assign(this.defaultHeaders, headers)
    return this
  }

  /** Set a bearer token for all subsequent requests. */
  withToken(token: string): this {
    this.defaultHeaders['Authorization'] = `Bearer ${token}`
    return this
  }

  /** Clear all cookies (start a fresh session). */
  flushCookies(): this {
    this.cookies.clear()
    return this
  }

  // ── HTTP methods ──────────────────────────────────────────────────────

  async get(path: string, headers?: Record<string, string>): Promise<TestResponse> {
    return this.call('GET', path, undefined, headers)
  }

  async post(path: string, body?: any, headers?: Record<string, string>): Promise<TestResponse> {
    return this.call('POST', path, body, headers)
  }

  async put(path: string, body?: any, headers?: Record<string, string>): Promise<TestResponse> {
    return this.call('PUT', path, body, headers)
  }

  async patch(path: string, body?: any, headers?: Record<string, string>): Promise<TestResponse> {
    return this.call('PATCH', path, body, headers)
  }

  async delete(path: string, headers?: Record<string, string>): Promise<TestResponse> {
    return this.call('DELETE', path, undefined, headers)
  }

  // ── Core request method ───────────────────────────────────────────────

  async call(
    method: string,
    path: string,
    body?: any,
    extraHeaders?: Record<string, string>,
  ): Promise<TestResponse> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...this.defaultHeaders,
      ...extraHeaders,
    }

    // Attach cookies
    if (this.cookies.size > 0) {
      headers['Cookie'] = [...this.cookies.entries()]
        .map(([k, v]) => `${k}=${v}`)
        .join('; ')
    }

    // For mutating requests, attach XSRF token from cookies
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const xsrf = this.cookies.get('XSRF-TOKEN')
      if (xsrf) headers['X-XSRF-TOKEN'] = decodeURIComponent(xsrf)
    }

    // Build body
    let requestBody: string | undefined
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
      requestBody = JSON.stringify(body)
    }

    const request = new Request(url, { method, headers, body: requestBody })
    const response = await this.handler(request)

    // Store cookies from response
    for (const cookie of response.headers.getSetCookie()) {
      const [nameValue] = cookie.split(';')
      const eqIdx = nameValue!.indexOf('=')
      if (eqIdx > 0) {
        const name = nameValue!.slice(0, eqIdx)
        const value = nameValue!.slice(eqIdx + 1)
        this.cookies.set(name, value)
      }
    }

    return new TestResponse(response)
  }

  // ── Session helpers ───────────────────────────────────────────────────

  /**
   * Initialize a session by hitting a page. Gets CSRF + session cookies.
   * Call this before making POST/PUT/DELETE requests on stateful routes.
   */
  async initSession(path = '/'): Promise<TestResponse> {
    return this.get(path)
  }
}
