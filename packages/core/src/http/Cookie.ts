import type { CookieOptions } from '../contracts/Response.ts'

export function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {}

  return Object.fromEntries(
    cookieHeader.split(';').map((pair) => {
      const [key, ...rest] = pair.trim().split('=')
      return [key?.trim() ?? '', decodeURIComponent(rest.join('='))]
    }),
  )
}

export function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  let str = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`

  if (options.maxAge !== undefined) str += `; Max-Age=${options.maxAge}`
  if (options.expires) str += `; Expires=${options.expires.toUTCString()}`
  if (options.path) str += `; Path=${options.path}`
  if (options.domain) str += `; Domain=${options.domain}`
  if (options.secure) str += '; Secure'
  if (options.httpOnly) str += '; HttpOnly'
  if (options.sameSite) str += `; SameSite=${options.sameSite}`

  return str
}
