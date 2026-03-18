import { HttpError } from './HttpError.ts'

export class UnauthorizedError extends HttpError {
  constructor(message = 'Unauthorized', headers?: Record<string, string>) {
    super(401, message, headers)
  }
}
