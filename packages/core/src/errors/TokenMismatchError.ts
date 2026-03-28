import { HttpError } from './HttpError.ts'
import { ErrorCodes } from './ErrorCodes.ts'

/**
 * Thrown when the CSRF token is missing or invalid.
 */
export class TokenMismatchError extends HttpError {
  constructor(message = 'CSRF token mismatch.') {
    super(419, message, undefined, undefined, ErrorCodes.CSRF_MISMATCH)
  }
}
