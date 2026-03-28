import { MantiqError } from './MantiqError.ts'
import { ErrorCodes } from './ErrorCodes.ts'

export class ConfigKeyNotFoundError extends MantiqError {
  constructor(public readonly key: string) {
    super(
      `Config key '${key}' not found and no default value provided.`,
      undefined,
      ErrorCodes.CONFIG_NOT_FOUND,
    )
  }
}
