import { MantiqError } from './MantiqError.ts'
import { ErrorCodes } from './ErrorCodes.ts'

export class ContainerResolutionError extends MantiqError {
  constructor(
    public readonly abstract: unknown,
    public readonly reason: 'not_bound' | 'circular_dependency' | 'unresolvable_parameter',
    public readonly details?: string,
  ) {
    super(
      `Cannot resolve ${String(abstract)}: ${reason}.${details ? ' ' + details : ''}`,
      undefined,
      ErrorCodes.CONTAINER_RESOLUTION,
    )
  }
}
