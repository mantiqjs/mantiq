import { MantiqError } from './MantiqError.ts'
import { ErrorCodes } from './ErrorCodes.ts'
import type { ErrorCode } from './ErrorCodes.ts'

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
    errorCode?: ErrorCode | string,
  ) {
    super(message, context, errorCode ?? ErrorCodes.HTTP_ERROR)
  }
}
