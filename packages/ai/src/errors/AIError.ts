import { MantiqError } from '@mantiq/core'

export class AIError extends MantiqError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, context)
  }
}
