import { UnauthorizedError } from '@mantiq/core'

/**
 * Thrown when authentication fails.
 * For web routes, includes a redirect URL. For API routes, returns 401.
 */
export class AuthenticationError extends UnauthorizedError {
  constructor(
    message = 'Unauthenticated.',
    public readonly redirectTo: string = '/login',
    public readonly guards: string[] = [],
  ) {
    super(message)
  }
}
