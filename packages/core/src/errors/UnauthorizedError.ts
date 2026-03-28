import { HttpError } from './HttpError.ts'
import { ErrorCodes } from './ErrorCodes.ts'

export class UnauthorizedError extends HttpError {
  constructor(message = 'Unauthorized', headers?: Record<string, string>) {
    super(401, message, headers, undefined, ErrorCodes.AUTH_UNAUTHENTICATED)
  }
}
