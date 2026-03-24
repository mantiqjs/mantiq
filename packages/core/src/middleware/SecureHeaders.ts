import type { Middleware, NextFunction } from '../contracts/Middleware.ts'
import type { MantiqRequest } from '../contracts/Request.ts'

/**
 * Security headers middleware.
 *
 * Adds common security headers to every response to protect against
 * clickjacking, MIME sniffing, XSS, and downgrade attacks.
 *
 * Register as 'secure-headers' alias and add to middleware groups:
 *   middlewareGroups: {
 *     web: ['cors', 'secure-headers', 'encrypt.cookies', 'session', 'csrf'],
 *   }
 */
export class SecureHeaders implements Middleware {
  async handle(request: MantiqRequest, next: NextFunction): Promise<Response> {
    const response = await next()
    const headers = new Headers(response.headers)

    // Prevent clickjacking — page cannot be embedded in iframes
    if (!headers.has('X-Frame-Options')) {
      headers.set('X-Frame-Options', 'SAMEORIGIN')
    }

    // Prevent MIME type sniffing — browser must respect Content-Type
    if (!headers.has('X-Content-Type-Options')) {
      headers.set('X-Content-Type-Options', 'nosniff')
    }

    // Enable browser XSS filter (legacy, but harmless)
    if (!headers.has('X-XSS-Protection')) {
      headers.set('X-XSS-Protection', '1; mode=block')
    }

    // Enforce HTTPS in production
    if (!headers.has('Strict-Transport-Security')) {
      if (process.env.APP_ENV === 'production') {
        headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
      }
    }

    // Control what the browser is allowed to load
    if (!headers.has('Content-Security-Policy')) {
      // Permissive default — users should tighten in production
      headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' ws: wss:")
    }

    // Prevent leaking referer to external sites
    if (!headers.has('Referrer-Policy')) {
      headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    }

    // Disable browser features you don't use
    if (!headers.has('Permissions-Policy')) {
      headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  }
}
