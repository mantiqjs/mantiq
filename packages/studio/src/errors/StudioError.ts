/**
 * Base error class for all Studio-specific errors.
 */
export class StudioError extends Error {
  public readonly code: string

  constructor(message: string, code: string = 'STUDIO_ERROR') {
    super(message)
    this.name = 'StudioError'
    this.code = code
  }
}
