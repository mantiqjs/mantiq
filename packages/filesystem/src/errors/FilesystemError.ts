import { MantiqError } from '@mantiq/core'

export class FilesystemError extends MantiqError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, context)
  }
}
