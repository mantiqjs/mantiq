import { HttpError } from '@mantiq/core'

/**
 * OAuth-specific error.
 * Defaults to 400 Bad Request. Use a different status code for specific cases.
 *
 * The `errorCode` property carries the OAuth2 error code
 * (e.g. 'invalid_request', 'invalid_grant') as defined by RFC 6749.
 */
export class OAuthError extends HttpError {
  constructor(
    message: string,
    errorCode: string = 'invalid_request',
    statusCode = 400,
  ) {
    super(statusCode, message, undefined, undefined, errorCode)
  }

  toJSON(): Record<string, any> {
    return {
      error: this.errorCode,
      error_description: this.message,
    }
  }
}
