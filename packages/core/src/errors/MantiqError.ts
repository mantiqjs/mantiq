import type { ErrorCode } from './ErrorCodes.ts'

/**
 * Base error class for all MantiqJS errors.
 * All packages must throw subclasses of this -- never raw Error.
 */
export class MantiqError extends Error {
  /**
   * Machine-readable error code for structured error handling.
   * Subclasses should set this to the appropriate `ErrorCodes.*` value.
   */
  public readonly errorCode: ErrorCode | undefined

  constructor(
    message: string,
    public readonly context?: Record<string, any>,
    errorCode?: ErrorCode,
  ) {
    super(message)
    this.name = this.constructor.name
    this.errorCode = errorCode
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}
