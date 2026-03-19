import type { Middleware, NextFunction } from '../contracts/Middleware.ts'
import type { MantiqRequest } from '../contracts/Request.ts'
import { AesEncrypter } from '../encryption/Encrypter.ts'
import { parseCookies, serializeCookie } from '../http/Cookie.ts'

/**
 * Middleware that encrypts outgoing cookies and decrypts incoming cookies.
 *
 * Cookies listed in `except` are left unencrypted (e.g. XSRF-TOKEN must be
 * readable by JavaScript for the double-submit pattern).
 */
export class EncryptCookies implements Middleware {
  /** Cookie names that should NOT be encrypted/decrypted. */
  protected except: string[] = []

  constructor(private readonly encrypter: AesEncrypter) {}

  async handle(request: MantiqRequest, next: NextFunction): Promise<Response> {
    // Decrypt incoming cookies by replacing the raw Request with decrypted values
    const decryptedRequest = await this.decryptRequest(request)

    const response = await next()

    return this.encryptResponse(response)
  }

  /**
   * Decrypt cookies on the incoming request.
   * We patch the raw Request's cookie header with decrypted values.
   */
  private async decryptRequest(request: MantiqRequest): Promise<MantiqRequest> {
    const raw = request.raw()
    const cookieHeader = raw.headers.get('cookie')
    if (!cookieHeader) return request

    const cookies = parseCookies(cookieHeader)
    const decrypted: Record<string, string> = {}

    for (const [name, value] of Object.entries(cookies)) {
      if (this.isExcluded(name)) {
        decrypted[name] = value
        continue
      }

      try {
        decrypted[name] = await this.encrypter.decrypt(value)
      } catch {
        // Can't decrypt — skip this cookie (expired key, tampered, etc.)
        decrypted[name] = value
      }
    }

    // Inject the decrypted cookies so subsequent middleware/handlers see plain values
    request.setCookies(decrypted)
    return request
  }

  /**
   * Encrypt cookies on the outgoing response.
   */
  private async encryptResponse(response: Response): Promise<Response> {
    const headers = new Headers(response.headers)
    const setCookies = headers.getSetCookie()

    if (setCookies.length === 0) return response

    // Remove existing Set-Cookie headers
    headers.delete('Set-Cookie')

    for (const setCookie of setCookies) {
      const [nameValue, ...parts] = setCookie.split('; ')
      const eqIdx = nameValue!.indexOf('=')
      const name = decodeURIComponent(nameValue!.slice(0, eqIdx))
      const value = decodeURIComponent(nameValue!.slice(eqIdx + 1))

      if (this.isExcluded(name)) {
        headers.append('Set-Cookie', setCookie)
        continue
      }

      try {
        const encrypted = await this.encrypter.encrypt(value)
        const newSetCookie = `${encodeURIComponent(name)}=${encodeURIComponent(encrypted)}; ${parts.join('; ')}`
        headers.append('Set-Cookie', newSetCookie)
      } catch {
        // If encryption fails, send unencrypted (shouldn't happen with valid key)
        headers.append('Set-Cookie', setCookie)
      }
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  }

  private isExcluded(name: string): boolean {
    return this.except.includes(name)
  }
}
