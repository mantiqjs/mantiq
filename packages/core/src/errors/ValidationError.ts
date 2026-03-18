import { HttpError } from './HttpError.ts'

export class ValidationError extends HttpError {
  constructor(
    public readonly errors: Record<string, string[]>,
    message = 'The given data was invalid.',
  ) {
    super(422, message, undefined, { errors })
  }
}
