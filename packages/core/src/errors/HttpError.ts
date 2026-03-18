import { MantiqError } from './MantiqError.ts'

/**
 * Base class for all HTTP-facing errors.
 * Automatically converted to an HTTP response by the exception handler.
 */
export class HttpError extends MantiqError {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly headers?: Record<string, string>,
    context?: Record<string, any>,
  ) {
    super(message, context)
  }
}
