import type { Authenticatable } from '../../src/contracts/Authenticatable.ts'
import type { UserProvider } from '../../src/contracts/UserProvider.ts'
import type { MantiqRequest } from '@mantiq/core'
import { MantiqRequestImpl, SessionStore, MemorySessionHandler } from '@mantiq/core'

/**
 * Fake user implementing Authenticatable for testing.
 */
export class FakeUser implements Authenticatable {
  constructor(
    public id: number,
    public email: string,
    public password: string, // hashed
    public rememberToken: string | null = null,
  ) {}

  getAuthIdentifierName(): string { return 'id' }
  getAuthIdentifier(): number { return this.id }
  getAuthPasswordName(): string { return 'password' }
  getAuthPassword(): string { return this.password }
  getRememberToken(): string | null { return this.rememberToken }
  setRememberToken(token: string | null): void { this.rememberToken = token }
  getRememberTokenName(): string { return 'remember_token' }

  // Authenticatable Model methods
  getAttribute(key: string): any { return (this as any)[key] }
  setAttribute(key: string, value: any): this { (this as any)[key] = value; return this }
  toObject(): Record<string, any> { return { id: this.id, email: this.email } }
  getKey(): number { return this.id }

  // Model-like methods for DatabaseUserProvider compatibility
  forceFill(data: Record<string, any>): this {
    for (const [k, v] of Object.entries(data)) {
      (this as any)[k === 'remember_token' ? 'rememberToken' : k] = v
    }
    return this
  }
  async save(): Promise<void> { /* noop in tests */ }
}

/**
 * In-memory user provider for testing.
 */
export class FakeUserProvider implements UserProvider {
  constructor(public users: FakeUser[] = []) {}

  async retrieveById(id: string | number): Promise<Authenticatable | null> {
    return this.users.find((u) => u.id === Number(id)) ?? null
  }

  async retrieveByToken(id: string | number, token: string): Promise<Authenticatable | null> {
    return this.users.find((u) => u.id === Number(id) && u.rememberToken === token) ?? null
  }

  async updateRememberToken(user: Authenticatable, token: string): Promise<void> {
    user.setRememberToken(token)
  }

  async retrieveByCredentials(credentials: Record<string, any>): Promise<Authenticatable | null> {
    return this.users.find((u) => {
      for (const [key, value] of Object.entries(credentials)) {
        if (key === 'password') continue
        if ((u as any)[key] !== value) return false
      }
      return true
    }) ?? null
  }

  async validateCredentials(user: Authenticatable, credentials: Record<string, any>): Promise<boolean> {
    // In tests, compare plain text (real provider uses hasher)
    return user.getAuthPassword() === credentials.password
  }

  async rehashPasswordIfRequired(_user: Authenticatable, _credentials: Record<string, any>): Promise<void> {
    // noop
  }
}

/**
 * Create a fake MantiqRequest with session support.
 */
export async function createFakeRequest(options: {
  method?: string
  path?: string
  headers?: Record<string, string>
  cookies?: Record<string, string>
} = {}): Promise<MantiqRequest> {
  const method = options.method ?? 'GET'
  const path = options.path ?? '/'
  const headers = new Headers(options.headers ?? {})

  // Build cookie header
  if (options.cookies) {
    const cookieStr = Object.entries(options.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ')
    headers.set('cookie', cookieStr)
  }

  const url = `http://localhost${path}`
  const bunRequest = new Request(url, { method, headers })

  const request = MantiqRequestImpl.fromBun(bunRequest) as unknown as MantiqRequest

  // Start a session
  const handler = new MemorySessionHandler()
  const session = new SessionStore('test_session', handler)
  await session.start()
  request.setSession(session)

  return request
}
