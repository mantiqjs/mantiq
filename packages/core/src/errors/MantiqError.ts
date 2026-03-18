/**
 * Base error class for all MantiqJS errors.
 * All packages must throw subclasses of this — never raw Error.
 */
export class MantiqError extends Error {
  constructor(
    message: string,
    public readonly context?: Record<string, any>,
  ) {
    super(message)
    this.name = this.constructor.name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}
