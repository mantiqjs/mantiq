import type { Guard } from '../contracts/Guard.ts'
import type { Authenticatable } from '../contracts/Authenticatable.ts'
import type { UserProvider } from '../contracts/UserProvider.ts'
import type { MantiqRequest } from '@mantiq/core'
import { PersonalAccessToken } from '../models/PersonalAccessToken.ts'
import { sha256 } from '../helpers/hash.ts'
import { timingSafeEqual } from 'node:crypto'

/**
 * Bearer-token authentication guard.
 *
 * SECURITY NOTE: Rate limiting is NOT applied at the guard level.
 * Consumers MUST apply rate-limit middleware (e.g. ThrottleMiddleware)
 * to routes protected by this guard to prevent brute-force token
 * enumeration attacks. Example:
 *
 *   router.group({ middleware: ['throttle:60,1'] }, () => {
 *     router.get('/api/user', ...)
 *   })
 */
export class TokenGuard implements Guard {
  private _user: Authenticatable | null = null
  private _request: MantiqRequest | null = null
  private _resolved = false

  constructor(
    private readonly name: string,
    private readonly provider: UserProvider,
    private readonly trackLastUsed = false,
  ) {}

  async check(): Promise<boolean> {
    return (await this.user()) !== null
  }

  async guest(): Promise<boolean> {
    return !(await this.check())
  }

  async user(): Promise<Authenticatable | null> {
    if (this._resolved) return this._user
    this._resolved = true

    if (!this._request) return null

    const bearerToken = this._request.bearerToken()
    if (!bearerToken) return null

    const token = await this.resolveToken(bearerToken)
    if (!token) return null

    // Optionally track last usage (disabled by default to avoid write-per-request)
    if (this.trackLastUsed) {
      token.setAttribute('last_used_at', new Date().toISOString())
      token.save().catch(() => {})
    }

    // Resolve user
    const userId = token.getAttribute('tokenable_id')
    const user = await this.provider.retrieveById(userId)
    if (!user) return null

    // Attach token to user if it supports it
    if (typeof (user as any).withAccessToken === 'function') {
      (user as any).withAccessToken(token)
    }

    this._user = user
    return user
  }

  async id(): Promise<string | number | null> {
    const user = await this.user()
    return user?.getAuthIdentifier() ?? null
  }

  async validate(credentials: Record<string, any>): Promise<boolean> {
    const user = await this.provider.retrieveByCredentials(credentials)
    if (!user) return false
    return this.provider.validateCredentials(user, credentials)
  }

  setUser(user: Authenticatable): void {
    this._user = user
    this._resolved = true
  }

  hasUser(): boolean {
    return this._user !== null
  }

  setRequest(request: MantiqRequest): void {
    this._request = request
    this._user = null
    this._resolved = false
  }

  /**
   * Validate that a bearer token string matches the expected format.
   * Expected format: `{numericId}|{hexPlaintext}` where plaintext is at
   * least 40 hex characters. Rejects malformed tokens early to avoid
   * unnecessary DB lookups and hash computation.
   */
  private isValidTokenFormat(id: string, plaintext: string): boolean {
    // id must be a positive integer
    if (!/^\d+$/.test(id)) return false
    // plaintext must be a hex string of at least 40 characters
    if (!/^[0-9a-f]{40,}$/i.test(plaintext)) return false
    return true
  }

  private async resolveToken(bearerToken: string): Promise<PersonalAccessToken | null> {
    const parts = bearerToken.split('|')

    if (parts.length === 2) {
      // Format: {id}|{plaintext}
      const [id, plaintext] = parts

      // #201: Validate token format before any DB lookup or hashing
      if (!id || !plaintext || !this.isValidTokenFormat(id, plaintext)) return null

      const token = await PersonalAccessToken.find(Number(id))
      if (!token) return null

      // #206: Check expiration before doing the expensive hash comparison.
      // This avoids wasting CPU on tokens that are already expired.
      if (token.isExpired()) return null

      const hash = await sha256(plaintext)
      const storedHash = token.getAttribute('token') as string

      // #200: Use constant-time comparison to prevent timing side-channel attacks
      // that could allow an attacker to guess the token hash byte-by-byte.
      if (!constantTimeEqual(hash, storedHash)) return null

      return token
    }

    // Fallback: hash the entire string and search by token hash
    const hash = await sha256(bearerToken)
    const token = await PersonalAccessToken.where('token', hash).first() as PersonalAccessToken | null

    // #206: Check expiration for fallback path as well
    if (token && token.isExpired()) return null

    return token
  }
}

/**
 * Constant-time string comparison using node:crypto's timingSafeEqual.
 * Prevents timing side-channel attacks on hash comparisons.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    const bufA = Buffer.from(a, 'utf-8')
    const bufB = Buffer.from(b, 'utf-8')
    return timingSafeEqual(bufA, bufB)
  } catch {
    return false
  }
}
