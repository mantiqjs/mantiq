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

  static redirect(url: string, status: number = 302): Response {
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
    const headers = new Headers({ Location: url, ...this.responseHeaders })
    for (const c of this.cookieStrings) headers.append('Set-Cookie', c)
    return new Response(null, { status: this.statusExplicitlySet ? this.statusCode : 302, headers })
  }
}

/** Shorthand to start a chainable builder */
export function response(): ResponseBuilder {
  return new ResponseBuilder()
}
