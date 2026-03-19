import { MantiqResponse, ResponseBuilder } from '../http/Response.ts'

/**
 * Create a chainable response builder.
 *
 * @example
 * response().status(201).cookie('token', 'abc').json({ created: true })
 */
export function response(): ResponseBuilder {
  return new ResponseBuilder()
}

/**
 * Return a JSON response.
 *
 * @example
 * return json({ users }, 200)
 * return json({ error: 'Not found' }, 404)
 */
export function json(data: any, status: number = 200, headers?: Record<string, string>): Response {
  return MantiqResponse.json(data, status, headers)
}

/**
 * Return an HTML response.
 *
 * @example return html('<h1>Hello</h1>')
 */
export function html(content: string, status: number = 200): Response {
  return MantiqResponse.html(content, status)
}

/**
 * Return a redirect response.
 *
 * @example return redirect('/dashboard')
 */
export function redirect(url: string, status: number = 302): Response {
  return MantiqResponse.redirect(url, status)
}

/** Return a 204 No Content response. */
export function noContent(): Response {
  return MantiqResponse.noContent()
}

/**
 * Return a streaming response.
 *
 * @example
 * return stream((controller) => {
 *   controller.enqueue('chunk 1')
 *   controller.close()
 * })
 */
export function stream(
  callback: (controller: ReadableStreamDefaultController) => void | Promise<void>,
): Response {
  return MantiqResponse.stream(callback)
}

/**
 * Return a file download response.
 *
 * @example return download(buffer, 'report.pdf')
 */
export function download(content: Uint8Array | string, filename: string, mimeType?: string): Response {
  return MantiqResponse.download(content, filename, mimeType)
}
