export class ConnectionError extends Error {
  constructor(
    message: string,
    public readonly driver: string,
    originalError?: Error,
  ) {
    super(originalError ? `${message}: ${originalError.message}` : message)
    this.name = 'ConnectionError'
  }
}
