import { MantiqError } from '@mantiq/core'

export class ModelNotFoundError extends MantiqError {
  constructor(
    public readonly modelName: string,
    public readonly id?: any,
  ) {
    super(
      id !== undefined
        ? `No ${modelName} found with ID ${id}.`
        : `No ${modelName} matching the given conditions.`,
    )
  }
}
