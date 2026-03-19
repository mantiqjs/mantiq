import { HttpError } from './HttpError.ts'

/**
 * Thrown when the CSRF token is missing or invalid.
 */
export class TokenMismatchError extends HttpError {
  constructor(message = 'CSRF token mismatch.') {
    super(419, message)
  }
}
