import type { Middleware, NextFunction } from '../contracts/Middleware.ts'
import type { MantiqRequest } from '../contracts/Request.ts'
import { TokenMismatchError } from '../errors/TokenMismatchError.ts'
import { AesEncrypter } from '../encryption/Encrypter.ts'
import { serializeCookie } from '../http/Cookie.ts'

/**
 * CSRF protection middleware.
 *
 * Verifies that state-changing requests (POST, PUT, PATCH, DELETE)
 * include a valid CSRF token. The token is checked against the session.
 *
 * Token can be provided via:
 * - `_token` field in the request body
 * - `X-CSRF-TOKEN` header (plain token)
 * - `X-XSRF-TOKEN` header (encrypted token — set from the XSRF-TOKEN cookie)
 *
 * Also sets the XSRF-TOKEN cookie (readable by JavaScript) on every response.
 */
export class VerifyCsrfToken implements Middleware {
  /** URIs that should be excluded from CSRF verification. */
  protected except: string[] = []

  constructor(private readonly encrypter: AesEncrypter) {}

  async handle(request: MantiqRequest, next: NextFunction): Promise<Response> {
    if (this.shouldVerify(request) && !(await this.tokensMatch(request))) {
      throw new TokenMismatchError()
    }

    const response = await next()

    return this.addXsrfCookie(response, request)
  }

  private shouldVerify(request: MantiqRequest): boolean {
    const method = request.method()

    // Read-only methods don't need CSRF
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return false

    // Check exclusions
    const path = request.path()
    return !this.except.some((pattern) => {
      if (pattern.endsWith('*')) {
        return path.startsWith(pattern.slice(0, -1))
      }
      return path === pattern
    })
  }

  private async tokensMatch(request: MantiqRequest): Promise<boolean> {
    if (!request.hasSession()) return false

    const sessionToken = request.session().token()
    const token = await this.getTokenFromRequest(request)

    if (!token || !sessionToken) return false

    return timingSafeEqual(token, sessionToken)
  }

  private async getTokenFromRequest(request: MantiqRequest): Promise<string | null> {
    // 1. Check _token in body (form submission)
    try {
      const bodyToken = await request.input('_token')
      if (bodyToken) return bodyToken
    } catch {
      // Body parsing might fail — continue
    }

    // 2. Check X-CSRF-TOKEN header (plain token, e.g. from meta tag)
    const csrfHeader = request.header('x-csrf-token')
    if (csrfHeader) return csrfHeader

    // 3. Check X-XSRF-TOKEN header (encrypted, from cookie)
    const xsrfHeader = request.header('x-xsrf-token')
    if (xsrfHeader) {
      try {
        return await this.encrypter.decrypt(xsrfHeader)
      } catch {
        return null
      }
    }

    return null
  }

  /**
   * Add XSRF-TOKEN cookie to response (readable by JavaScript).
   */
  private addXsrfCookie(response: Response, request: MantiqRequest): Response {
    if (!request.hasSession()) return response

    const token = request.session().token()
    const headers = new Headers(response.headers)

    headers.append(
      'Set-Cookie',
      serializeCookie('XSRF-TOKEN', token, {
        path: '/',
        httpOnly: false, // Must be readable by JS
        sameSite: 'Lax',
      }),
    )

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  }
}

/**
 * Constant-time string comparison to prevent timing attacks on token verification.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false

  const encoder = new TextEncoder()
  const bufA = encoder.encode(a)
  const bufB = encoder.encode(b)

  let result = 0
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i]! ^ bufB[i]!
  }
  return result === 0
}
