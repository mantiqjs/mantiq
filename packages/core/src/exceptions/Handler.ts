import type { ExceptionHandler } from '../contracts/ExceptionHandler.ts'
import type { Constructor } from '../contracts/Container.ts'
import type { MantiqRequest } from '../contracts/Request.ts'
import { HttpError } from '../errors/HttpError.ts'
import { NotFoundError } from '../errors/NotFoundError.ts'
import { ValidationError } from '../errors/ValidationError.ts'
import { UnauthorizedError } from '../errors/UnauthorizedError.ts'
import { MantiqResponse } from '../http/Response.ts'
import { renderDevErrorPage } from './DevErrorPage.ts'

export class DefaultExceptionHandler implements ExceptionHandler {
  dontReport: Constructor<Error>[] = [
    NotFoundError,
    ValidationError,
    UnauthorizedError,
  ]

  async report(error: Error): Promise<void> {
    // Default: write to stderr. Replaced by @mantiq/logging when installed.
    console.error(`[${new Date().toISOString()}] ${error.name}: ${error.message}`)
    if (error.stack) console.error(error.stack)
  }

  render(request: MantiqRequest, error: unknown): Response {
    const err = error instanceof Error ? error : new Error(String(error))

    // Conditionally report
    const shouldSkip = this.dontReport.some((cls) => err instanceof cls)
    if (!shouldSkip) {
      void this.report(err)
    }

    const debug = process.env['APP_DEBUG'] === 'true'

    // HttpError — use its status code
    if (err instanceof HttpError) {
      return this.renderHttpError(request, err, debug)
    }

    // Unknown error — 500
    return this.renderServerError(request, err, debug)
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private renderHttpError(
    request: MantiqRequest,
    err: HttpError,
    debug: boolean,
  ): Response {
    // Errors with a redirectTo property (e.g. AuthenticationError) should redirect,
    // not show the error page — even in debug mode.
    if ('redirectTo' in err && typeof (err as any).redirectTo === 'string' && !request.expectsJson()) {
      return MantiqResponse.redirect((err as any).redirectTo)
    }

    // API routes always get JSON — even in debug mode
    if (request.expectsJson()) {
      const body: Record<string, any> = {
        error: { message: err.message, status: err.statusCode },
      }
      if (err instanceof ValidationError) {
        body['error']['errors'] = err.errors
      }
      if (debug && err.stack) {
        body['error']['trace'] = err.stack.split('\n').map((l: string) => l.trim())
      }
      return MantiqResponse.json(body, err.statusCode, err.headers)
    }

    if (debug) {
      return MantiqResponse.html(renderDevErrorPage(request, err), err.statusCode)
    }

    return MantiqResponse.html(
      this.genericHtmlPage(err.statusCode, err.message),
      err.statusCode,
    )
  }

  private renderServerError(
    request: MantiqRequest,
    err: Error,
    debug: boolean,
  ): Response {
    // API routes always get JSON — even in debug mode
    if (request.expectsJson()) {
      const body: Record<string, any> = { error: { message: 'Internal Server Error', status: 500 } }
      if (debug && err.stack) {
        body['error']['message'] = err.message
        body['error']['trace'] = err.stack.split('\n').map((l: string) => l.trim())
      }
      return MantiqResponse.json(body, 500)
    }

    if (debug) {
      return MantiqResponse.html(renderDevErrorPage(request, err), 500)
    }

    return MantiqResponse.html(this.genericHtmlPage(500, 'Internal Server Error'), 500)
  }

  private genericHtmlPage(status: number, message: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${status} ${message}</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f7fafc; color: #2d3748; }
    .box { text-align: center; }
    h1 { font-size: 6rem; font-weight: 900; color: #e2e8f0; margin: 0; line-height: 1; }
    p { font-size: 1.25rem; color: #718096; margin-top: 1rem; }
  </style>
</head>
<body>
  <div class="box">
    <h1>${status}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`
  }
}
