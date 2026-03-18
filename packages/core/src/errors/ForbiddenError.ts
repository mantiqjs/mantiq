import { HttpError } from './HttpError.ts'

export class ForbiddenError extends HttpError {
  constructor(message = 'Forbidden', headers?: Record<string, string>) {
    super(403, message, headers)
  }
}
