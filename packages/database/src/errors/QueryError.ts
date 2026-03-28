import { MantiqError, ErrorCodes } from '@mantiq/core'

export class QueryError extends MantiqError {
  constructor(
    public readonly sql: string,
    public readonly bindings: any[],
    public readonly originalError: Error,
  ) {
    super(`Database query failed: ${originalError.message}`, { sql, bindings }, ErrorCodes.QUERY_ERROR)
  }
}
