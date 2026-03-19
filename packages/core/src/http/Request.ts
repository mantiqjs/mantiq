import type { MantiqRequest as MantiqRequestContract } from '../contracts/Request.ts'
import type { SessionStore } from '../session/Store.ts'
import { UploadedFile } from './UploadedFile.ts'
import { parseCookies } from './Cookie.ts'

export class MantiqRequest implements MantiqRequestContract {
  private parsedBody: Record<string, any> | null = null
  private parsedFiles: Record<string, UploadedFile | UploadedFile[]> = {}
  private parsedQuery: Record<string, string> | null = null
  private routeParams: Record<string, any> = {}
  private authenticatedUser: any = null
  private cookies: Record<string, string> | null = null
  private sessionStore: SessionStore | null = null

  constructor(
    private readonly bunRequest: Request,
    private readonly bunUrl: URL,
  ) {}

  /**
   * Create from a Bun Request. Parses the URL once and caches it.
   */
  static fromBun(request: Request): MantiqRequest {
    const url = new URL(request.url)
    return new MantiqRequest(request, url)
  }

  // ── HTTP basics ──────────────────────────────────────────────────────────

  method(): string {
    return this.bunRequest.method.toUpperCase()
  }

  path(): string {
    return this.bunUrl.pathname
  }

  url(): string {
    return this.bunUrl.pathname + this.bunUrl.search
  }

  fullUrl(): string {
    return this.bunRequest.url
  }

  // ── Input ────────────────────────────────────────────────────────────────

  query(): Record<string, string>
  query(key: string, defaultValue?: string): string
  query(key?: string, defaultValue?: string): string | Record<string, string> {
    if (!this.parsedQuery) {
      this.parsedQuery = Object.fromEntries(this.bunUrl.searchParams.entries())
    }
    if (key === undefined) return this.parsedQuery
    return this.parsedQuery[key] ?? defaultValue ?? (undefined as any)
  }

  async input(): Promise<Record<string, any>>
  async input(key: string, defaultValue?: any): Promise<any>
  async input(key?: string, defaultValue?: any): Promise<any> {
    if (!this.parsedBody) {
      await this.parseBody()
    }
    const merged = { ...this.query(), ...this.parsedBody }
    if (key === undefined) return merged
    return merged[key] ?? defaultValue
  }

  async only(...keys: string[]): Promise<Record<string, any>> {
    const all = await this.input()
    return Object.fromEntries(keys.filter((k) => k in all).map((k) => [k, all[k]]))
  }

  async except(...keys: string[]): Promise<Record<string, any>> {
    const all = await this.input()
    return Object.fromEntries(Object.entries(all).filter(([k]) => !keys.includes(k)))
  }

  has(...keys: string[]): boolean {
    const q = this.query()
    return keys.every((k) => k in q || (this.parsedBody !== null && k in this.parsedBody))
  }

  async filled(...keys: string[]): Promise<boolean> {
    const all = await this.input()
    return keys.every((k) => all[k] !== undefined && all[k] !== '' && all[k] !== null)
  }

  // ── Headers & metadata ───────────────────────────────────────────────────

  header(key: string, defaultValue?: string): string | undefined {
    return this.bunRequest.headers.get(key.toLowerCase()) ?? defaultValue
  }

  headers(): Record<string, string> {
    const result: Record<string, string> = {}
    this.bunRequest.headers.forEach((value, key) => {
      result[key] = value
    })
    return result
  }

  cookie(key: string, defaultValue?: string): string | undefined {
    if (!this.cookies) {
      this.cookies = parseCookies(this.bunRequest.headers.get('cookie'))
    }
    return this.cookies[key] ?? defaultValue
  }

  setCookies(cookies: Record<string, string>): void {
    this.cookies = cookies
  }

  ip(): string {
    // @internal: Bun doesn't expose IP on Request — callers should pass it via middleware if needed
    return this.header('x-forwarded-for')?.split(',')[0]?.trim()
      ?? this.header('x-real-ip')
      ?? '127.0.0.1'
  }

  userAgent(): string {
    return this.header('user-agent') ?? ''
  }

  accepts(...types: string[]): string | false {
    const acceptHeader = this.header('accept') ?? '*/*'
    for (const type of types) {
      if (acceptHeader.includes(type) || acceptHeader.includes('*/*')) {
        return type
      }
    }
    return false
  }

  expectsJson(): boolean {
    const accept = this.header('accept') ?? ''
    return accept.includes('application/json') || accept.includes('text/json')
  }

  isJson(): boolean {
    const ct = this.header('content-type') ?? ''
    return ct.includes('application/json')
  }

  // ── Files ────────────────────────────────────────────────────────────────

  file(key: string): UploadedFile | null {
    const f = this.parsedFiles[key]
    if (!f) return null
    return Array.isArray(f) ? (f[0] ?? null) : f
  }

  files(key: string): UploadedFile[] {
    const f = this.parsedFiles[key]
    if (!f) return []
    return Array.isArray(f) ? f : [f]
  }

  hasFile(key: string): boolean {
    return key in this.parsedFiles
  }

  // ── Route params ─────────────────────────────────────────────────────────

  param(key: string, defaultValue?: any): any {
    return this.routeParams[key] ?? defaultValue
  }

  params(): Record<string, any> {
    return { ...this.routeParams }
  }

  setRouteParams(params: Record<string, any>): void {
    this.routeParams = params
  }

  // ── Session ──────────────────────────────────────────────────────────────

  session(): SessionStore {
    if (!this.sessionStore) {
      throw new Error('Session has not been started. Ensure the StartSession middleware is active.')
    }
    return this.sessionStore
  }

  setSession(session: SessionStore): void {
    this.sessionStore = session
  }

  hasSession(): boolean {
    return this.sessionStore !== null
  }

  // ── Auth ─────────────────────────────────────────────────────────────────

  user<T = any>(): T | null {
    return this.authenticatedUser as T | null
  }

  isAuthenticated(): boolean {
    return this.authenticatedUser !== null
  }

  setUser(user: any): void {
    this.authenticatedUser = user
  }

  // ── Raw ──────────────────────────────────────────────────────────────────

  raw(): Request {
    return this.bunRequest
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async parseBody(): Promise<void> {
    this.parsedBody = {}

    const contentType = this.header('content-type') ?? ''

    try {
      if (contentType.includes('application/json')) {
        this.parsedBody = await this.bunRequest.clone().json()
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const text = await this.bunRequest.clone().text()
        this.parsedBody = Object.fromEntries(new URLSearchParams(text).entries())
      } else if (contentType.includes('multipart/form-data')) {
        const formData = await this.bunRequest.clone().formData()
        for (const [key, value] of formData.entries()) {
          if (value instanceof File) {
            const uploaded = new UploadedFile(value)
            if (this.parsedFiles[key]) {
              const existing = this.parsedFiles[key]!
              this.parsedFiles[key] = Array.isArray(existing)
                ? [...existing, uploaded]
                : [existing, uploaded]
            } else {
              this.parsedFiles[key] = uploaded
            }
          } else {
            this.parsedBody![key] = value
          }
        }
      }
    } catch {
      // Body parsing failed — leave parsedBody as empty object
    }
  }
}
