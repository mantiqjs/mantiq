import { HttpError } from './HttpError.ts'
import { ErrorCodes } from './ErrorCodes.ts'

export class ValidationError extends HttpError {
  constructor(
    public readonly errors: Record<string, string[]>,
    message = 'The given data was invalid.',
  ) {
    super(422, message, undefined, { errors }, ErrorCodes.VALIDATION_FAILED)
  }
}
