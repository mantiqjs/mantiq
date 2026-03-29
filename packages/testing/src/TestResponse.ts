import { expect } from 'bun:test'

/**
 * Wraps a fetch Response with fluent assertion helpers.
 *
 * @example
 *   const res = await client.post('/register', { name: 'Ali' })
 *   res.assertStatus(201)
 *   res.assertJson({ message: 'Registered.' })
 *   res.assertHeader('content-type', 'application/json')
 */
export class TestResponse {
  public readonly status: number
  public readonly headers: Headers
  private _body: string | null = null
  private _json: any = undefined

  constructor(
    private readonly raw: Response,
  ) {
    this.status = raw.status
    this.headers = raw.headers
  }

  /** Get the response body as text. */
  async text(): Promise<string> {
    if (this._body === null) this._body = await this.raw.text()
    return this._body
  }

  /** Get the response body as parsed JSON. */
  async json<T = any>(): Promise<T> {
    if (this._json === undefined) {
      const body = await this.text()
      // Fix #214: Provide a helpful error message when JSON parsing fails
      try {
        this._json = JSON.parse(body)
      } catch {
        const preview = body.length > 200 ? body.slice(0, 200) + '...' : body
        throw new Error(
          `Failed to parse JSON from response (HTTP ${this.status}). Body preview: ${preview}`,
        )
      }
    }
    return this._json
  }

  // ── Status assertions ─────────────────────────────────────────────────

  assertStatus(expected: number): this {
    expect(this.status).toBe(expected)
    return this
  }

  assertOk(): this { return this.assertStatus(200) }
  assertCreated(): this { return this.assertStatus(201) }
  assertNoContent(): this { return this.assertStatus(204) }
  assertNotFound(): this { return this.assertStatus(404) }
  assertUnauthorized(): this { return this.assertStatus(401) }
  assertForbidden(): this { return this.assertStatus(403) }
  assertUnprocessable(): this { return this.assertStatus(422) }

  assertSuccessful(): this {
    expect(this.status).toBeGreaterThanOrEqual(200)
    expect(this.status).toBeLessThan(300)
    return this
  }

  assertRedirect(url?: string): this {
    expect(this.status).toBeGreaterThanOrEqual(300)
    expect(this.status).toBeLessThan(400)
    if (url) expect(this.headers.get('location')).toBe(url)
    return this
  }

  // ── Body assertions ───────────────────────────────────────────────────

  /** Assert response body contains the given JSON subset. */
  async assertJson(expected: Record<string, any>): Promise<this> {
    const data = await this.json()
    for (const [key, value] of Object.entries(expected)) {
      expect(data[key]).toEqual(value)
    }
    return this
  }

  /** Assert response body exactly matches the given JSON. */
  async assertExactJson(expected: any): Promise<this> {
    const data = await this.json()
    expect(data).toEqual(expected)
    return this
  }

  /** Assert the JSON response has the given key(s). */
  async assertJsonHasKey(...keys: string[]): Promise<this> {
    const data = await this.json()
    for (const key of keys) {
      expect(data).toHaveProperty(key)
    }
    return this
  }

  /** Assert the JSON response is missing the given key(s). */
  async assertJsonMissingKey(...keys: string[]): Promise<this> {
    const data = await this.json()
    for (const key of keys) {
      expect(data[key]).toBeUndefined()
    }
    return this
  }

  /** Assert value at a dot-notation path in the JSON response. */
  async assertJsonPath(path: string, expected: any): Promise<this> {
    const data = await this.json()
    const value = resolvePath(data, path)
    expect(value).toEqual(expected)
    return this
  }

  /** Assert the number of items at a dot-notation path (or root if no path). */
  async assertJsonCount(count: number, path?: string): Promise<this> {
    const data = await this.json()
    const target = path ? resolvePath(data, path) : data
    expect(Array.isArray(target) ? target.length : Object.keys(target).length).toBe(count)
    return this
  }

  /** Assert the JSON response matches a structure (keys only, no values). */
  async assertJsonStructure(structure: string[] | Record<string, any>, path?: string): Promise<this> {
    const data = await this.json()
    const target = path ? resolvePath(data, path) : data
    assertStructure(target, structure)
    return this
  }

  /** Assert the JSON response does NOT contain the given subset. */
  async assertJsonMissing(unexpected: Record<string, any>): Promise<this> {
    const data = await this.json()
    for (const [key, value] of Object.entries(unexpected)) {
      if (data[key] !== undefined) expect(data[key]).not.toEqual(value)
    }
    return this
  }

  /** Assert strings appear in order in the response body. */
  async assertSeeInOrder(texts: string[]): Promise<this> {
    const body = await this.text()
    let lastIndex = -1
    for (const text of texts) {
      const idx = body.indexOf(text, lastIndex + 1)
      expect(idx).toBeGreaterThan(lastIndex)
      lastIndex = idx
    }
    return this
  }

  /** Assert response body contains a string. */
  async assertSee(text: string): Promise<this> {
    const body = await this.text()
    expect(body).toContain(text)
    return this
  }

  /** Assert response body does not contain a string. */
  async assertDontSee(text: string): Promise<this> {
    const body = await this.text()
    expect(body).not.toContain(text)
    return this
  }

  // ── Header assertions ─────────────────────────────────────────────────

  assertHeader(name: string, value?: string): this {
    const actual = this.headers.get(name)
    expect(actual).not.toBeNull()
    if (value !== undefined) expect(actual).toBe(value)
    return this
  }

  assertHeaderMissing(name: string): this {
    expect(this.headers.get(name)).toBeNull()
    return this
  }

  // ── Cookie assertions ─────────────────────────────────────────────────

  assertCookie(name: string): this {
    const cookies = this.headers.getSetCookie()
    const found = cookies.some(c => c.startsWith(`${name}=`))
    expect(found).toBe(true)
    return this
  }

  assertCookieMissing(name: string): this {
    const cookies = this.headers.getSetCookie()
    const found = cookies.some(c => c.startsWith(`${name}=`))
    expect(found).toBe(false)
    return this
  }

  // ── Extra status assertions ────────────────────────────────────────────

  assertServerError(): this {
    expect(this.status).toBeGreaterThanOrEqual(500)
    expect(this.status).toBeLessThan(600)
    return this
  }

  assertClientError(): this {
    expect(this.status).toBeGreaterThanOrEqual(400)
    expect(this.status).toBeLessThan(500)
    return this
  }

  // ── Validation assertions ──────────────────────────────────────────────

  /** Assert the response has no validation errors (status is not 422). */
  assertValid(): this {
    expect(this.status).not.toBe(422)
    return this
  }

  /** Assert the response has validation errors (status 422), optionally for specific fields. */
  async assertInvalid(fields?: string[]): Promise<this> {
    expect(this.status).toBe(422)
    if (fields) {
      const data = await this.json()
      const errors = data.errors ?? data
      for (const field of fields) {
        expect(errors[field]).toBeDefined()
      }
    }
    return this
  }

  // ── Download assertion ─────────────────────────────────────────────────

  assertDownload(filename?: string): this {
    const disposition = this.headers.get('content-disposition')
    expect(disposition).not.toBeNull()
    expect(disposition!).toContain('attachment')
    if (filename) expect(disposition!).toContain(filename)
    return this
  }

  // ── Debug helpers ──────────────────────────────────────────────────────

  /** Print response status + body to console. */
  async dump(): Promise<this> {
    console.log(`[${this.status}]`, await this.text())
    return this
  }

  /** Print response and throw to stop test. */
  async dd(): Promise<never> {
    console.log(`[${this.status}]`, await this.text())
    throw new Error('dd() called on TestResponse')
  }
}

// ── Utility functions ─────────────────────────────────────────────────────

/** Resolve a dot-notation path on an object: 'data.users.0.name' */
function resolvePath(obj: any, path: string): any {
  return path.split('.').reduce((cur, key) => cur?.[key], obj)
}

/** Recursively check that an object matches a structure definition. */
function assertStructure(data: any, structure: string[] | Record<string, any>): void {
  if (Array.isArray(structure)) {
    for (const key of structure) {
      expect(data).toHaveProperty(key)
    }
  } else {
    for (const [key, nested] of Object.entries(structure)) {
      expect(data).toHaveProperty(key)
      if (Array.isArray(nested) || (typeof nested === 'object' && nested !== null)) {
        if (Array.isArray(data[key]) && data[key].length > 0) {
          // Check first item of array against nested structure
          assertStructure(data[key][0], nested)
        } else {
          assertStructure(data[key], nested)
        }
      }
    }
  }
}
