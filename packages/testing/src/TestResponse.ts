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
    if (this._json === undefined) this._json = JSON.parse(await this.text())
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
}
