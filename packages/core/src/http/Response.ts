import type { CookieOptions, MantiqResponseBuilder } from '../contracts/Response.ts'
import { serializeCookie } from './Cookie.ts'

/**
 * Static factory methods for common response types.
 */
export class MantiqResponse {
  static json(data: any, status: number = 200, headers?: Record<string, string>): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json', ...headers },
    })
  }

  static html(content: string, status: number = 200): Response {
    return new Response(content, {
      status,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  /**
   * Validate that a redirect URL is safe.
   * Security: reject protocol-relative URLs (//evil.com), javascript:, data:,
   * and other dangerous schemes that could redirect users to malicious sites.
   * Only relative paths and http(s) URLs on the same origin are allowed.
   */
  private static validateRedirectUrl(url: string): void {
    const trimmed = url.trim()

    // Reject protocol-relative URLs (//evil.com)
    if (trimmed.startsWith('//')) {
      throw new Error('Unsafe redirect URL: protocol-relative URLs are not allowed')
    }

    // Reject dangerous schemes
    const lower = trimmed.toLowerCase()
    if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) {
      throw new Error('Unsafe redirect URL: dangerous scheme detected')
    }

    // If it looks like an absolute URL, only allow http(s)
    if (/^[a-z][a-z0-9+\-.]*:/i.test(trimmed)) {
      if (!lower.startsWith('http://') && !lower.startsWith('https://')) {
        throw new Error('Unsafe redirect URL: only http and https schemes are allowed')
      }
    }
  }

  static redirect(url: string, status: number = 302): Response {
    MantiqResponse.validateRedirectUrl(url)
    return new Response(null, {
      status,
      headers: { Location: url },
    })
  }

  static noContent(): Response {
    return new Response(null, { status: 204 })
  }

  static stream(
    callback: (controller: ReadableStreamDefaultController) => void | Promise<void>,
  ): Response {
    const stream = new ReadableStream({ start: callback })
    return new Response(stream)
  }

  static download(
    content: Uint8Array | string,
    filename: string,
    mimeType?: string,
  ): Response {
    return new Response(content, {
      headers: {
        'Content-Type': mimeType ?? 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  }
}

/**
 * Chainable response builder for use in middleware and controllers.
 */
export class ResponseBuilder implements MantiqResponseBuilder {
  private statusCode: number = 200
  private statusExplicitlySet: boolean = false
  private responseHeaders: Record<string, string> = {}
  private cookieStrings: string[] = []

  status(code: number): this {
    this.statusCode = code
    this.statusExplicitlySet = true
    return this
  }

  header(key: string, value: string): this {
    this.responseHeaders[key] = value
    return this
  }

  withHeaders(headers: Record<string, string>): this {
    Object.assign(this.responseHeaders, headers)
    return this
  }

  cookie(name: string, value: string, options?: CookieOptions): this {
    this.cookieStrings.push(serializeCookie(name, value, options))
    return this
  }

  json(data: any): Response {
    const headers = new Headers({
      'Content-Type': 'application/json',
      ...this.responseHeaders,
    })
    for (const c of this.cookieStrings) headers.append('Set-Cookie', c)
    return new Response(JSON.stringify(data), { status: this.statusCode, headers })
  }

  html(content: string): Response {
    const headers = new Headers({
      'Content-Type': 'text/html; charset=utf-8',
      ...this.responseHeaders,
    })
    for (const c of this.cookieStrings) headers.append('Set-Cookie', c)
    return new Response(content, { status: this.statusCode, headers })
  }

  redirect(url: string): Response {
    // Security: reuse the same URL validation as MantiqResponse.redirect()
    MantiqResponse['validateRedirectUrl'](url)
    const headers = new Headers({ Location: url, ...this.responseHeaders })
    for (const c of this.cookieStrings) headers.append('Set-Cookie', c)
    return new Response(null, { status: this.statusExplicitlySet ? this.statusCode : 302, headers })
  }
}

/** Shorthand to start a chainable builder */
export function response(): ResponseBuilder {
  return new ResponseBuilder()
}
