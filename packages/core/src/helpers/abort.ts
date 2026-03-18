import { HttpError } from '../errors/HttpError.ts'
import { NotFoundError } from '../errors/NotFoundError.ts'
import { UnauthorizedError } from '../errors/UnauthorizedError.ts'
import { ForbiddenError } from '../errors/ForbiddenError.ts'
import { TooManyRequestsError } from '../errors/TooManyRequestsError.ts'

const STATUS_MESSAGES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  410: 'Gone',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
}

/**
 * Throw an HTTP exception from anywhere — controllers, middleware, services.
 *
 * Uses typed error subclasses where available.
 *
 * @throws HttpError (or typed subclass)
 *
 * @example abort(404)
 * @example abort(403, 'You cannot edit this post')
 * @example abort(429, 'Slow down', { 'Retry-After': '60' })
 */
export function abort(
  status: number,
  message?: string,
  headers?: Record<string, string>,
): never {
  const msg = message ?? STATUS_MESSAGES[status] ?? 'Error'

  switch (status) {
    case 401: throw new UnauthorizedError(msg, headers)
    case 403: throw new ForbiddenError(msg, headers)
    case 404: throw new NotFoundError(msg, headers)
    case 429: throw new TooManyRequestsError(msg)
    default:  throw new HttpError(status, msg, headers)
  }
}
