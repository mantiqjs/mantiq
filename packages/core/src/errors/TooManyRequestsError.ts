import { HttpError } from './HttpError.ts'
import { ErrorCodes } from './ErrorCodes.ts'

export class TooManyRequestsError extends HttpError {
  constructor(
    message = 'Too Many Requests',
    public readonly retryAfter?: number,
  ) {
    super(429, message, retryAfter ? { 'Retry-After': String(retryAfter) } : undefined, undefined, ErrorCodes.RATE_LIMITED)
  }
}
