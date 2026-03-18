import { MantiqError } from '@mantiq/core'

export class ConnectionError extends MantiqError {
  constructor(
    public readonly driver: string,
    originalError: Error,
  ) {
    super(`Failed to connect to ${driver} database: ${originalError.message}`)
  }
}
