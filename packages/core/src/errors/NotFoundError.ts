import { HttpError } from './HttpError.ts'

export class NotFoundError extends HttpError {
  constructor(message = 'Not Found', headers?: Record<string, string>) {
    super(404, message, headers)
  }
}
