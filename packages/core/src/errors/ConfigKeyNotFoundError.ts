import { MantiqError } from './MantiqError.ts'

export class ConfigKeyNotFoundError extends MantiqError {
  constructor(public readonly key: string) {
    super(`Config key '${key}' not found and no default value provided.`)
  }
}
