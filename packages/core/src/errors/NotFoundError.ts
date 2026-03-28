import { HttpError } from './HttpError.ts'
import { ErrorCodes } from './ErrorCodes.ts'

export class NotFoundError extends HttpError {
  constructor(message = 'Not Found', headers?: Record<string, string>) {
    super(404, message, headers, undefined, ErrorCodes.ROUTE_NOT_FOUND)
  }
}
