import { HttpError } from '@mantiq/core'

/**
 * OAuth-specific error.
 * Defaults to 400 Bad Request. Use a different status code for specific cases.
 */
export class OAuthError extends HttpError {
  constructor(
    message: string,
    public readonly errorCode: string = 'invalid_request',
    statusCode = 400,
  ) {
    super(statusCode, message)
  }

  toJSON(): Record<string, any> {
    return {
      error: this.errorCode,
      error_description: this.message,
    }
  }
}
