import { MantiqError, ErrorCodes } from '@mantiq/core'

export class ConnectionError extends MantiqError {
  constructor(
    message: string,
    public readonly driver: string,
    originalError?: Error,
  ) {
    super(
      originalError ? `${message}: ${originalError.message}` : message,
      { driver },
      ErrorCodes.CONNECTION_FAILED,
    )
  }
}
