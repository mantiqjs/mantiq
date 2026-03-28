import { HttpError } from './HttpError.ts'
import { ErrorCodes } from './ErrorCodes.ts'

export class ForbiddenError extends HttpError {
  constructor(message = 'Forbidden', headers?: Record<string, string>) {
    super(403, message, headers, undefined, ErrorCodes.AUTH_FORBIDDEN)
  }
}
